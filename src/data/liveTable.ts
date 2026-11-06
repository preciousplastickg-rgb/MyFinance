import Dexie, { type IntervalTree, type IntervalTreeNode, type ObservabilitySet } from 'dexie';
import { useEffect, useState, useSyncExternalStore } from 'react';

/** Что нужно от таблицы Dexie: прочитать всё и дочитать строки по ключам. */
interface TableLike<T> {
  name: string;
  db: { name: string };
  toArray(): Promise<T[]>;
  bulkGet(keys: string[]): Promise<(T | undefined)[]>;
}

/** Больше ключей за одну запись — проще перечитать таблицу целиком. */
const MAX_PATCH_KEYS = 200;

/**
 * Первичные ключи из дерева интервалов Dexie, если все узлы точечные (from === to) и их немного.
 * Иначе (bulkAdd от 50 строк, clear, импорт бэкапа — полный диапазон) — null: нужна полная перечитка.
 * После коммита Dexie отдаёт дерево обычным объектом без итератора RangeSet, поэтому обход свой.
 */
export function discreteKeys(tree: IntervalTree, max = MAX_PATCH_KEYS): string[] | null {
  const keys: string[] = [];
  const walk = (node: IntervalTreeNode | null | undefined): boolean => {
    if (!node) return true;
    if (!walk(node.l)) return false;
    if (typeof node.from !== 'string' || node.from !== node.to) return false;
    keys.push(node.from);
    return keys.length <= max && walk(node.r);
  };
  if (!('from' in tree)) return keys; // пустой набор
  return walk(tree) ? keys : null;
}

/**
 * Массив строк таблицы, живущий в памяти и обновляемый точечно (вместо liveQuery с toArray всей таблицы на каждую запись).
 * Dexie после коммита сообщает ключи изменённых строк (событие storagemutated): дочитываем только их через bulkGet.
 * Массовые изменения — полная перечитка. Обновления идут по очереди, чтобы ответ старого чтения не перекрыл новое.
 */
export class LiveTable<T> {
  current: readonly T[] | undefined;
  error: unknown = null;
  private readonly part: string;
  private readonly listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  private active = false;

  constructor(
    private readonly table: TableLike<T>,
    private readonly keyOf: (row: T) => string,
    /** Порядок и фильтр массива (сортировка по sortOrder, скрытие удалённых). Получает свежую копию. */
    private readonly prepare: (rows: T[]) => T[] = (rows) => rows,
  ) {
    this.part = `idb://${table.db.name}/${table.name}/`;
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    Dexie.on.storagemutated.subscribe(this.onMutated);
    this.enqueue(() => this.reload());
  }

  stop(): void {
    this.active = false;
    Dexie.on.storagemutated.unsubscribe(this.onMutated);
  }

  /** Все начатые обновления применены. */
  whenIdle(): Promise<void> {
    return this.queue;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): readonly T[] | undefined => this.current;

  private readonly onMutated = (parts: ObservabilitySet): void => {
    const set = parts[this.part];
    if (!set) return;
    const keys = discreteKeys(set);
    this.enqueue(() => (keys && this.current ? this.patch(keys) : this.reload()));
  };

  private enqueue(step: () => Promise<void>): void {
    this.queue = this.queue.then(step).catch((e: unknown) => {
      console.error(e);
      this.error = e instanceof Error ? e : new Error(String(e));
      this.notify();
    });
  }

  private async reload(): Promise<void> {
    const rows = await this.table.toArray();
    if (!this.active) return;
    this.set(rows);
  }

  private async patch(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const rows = await this.table.bulkGet(keys);
    if (!this.active || !this.current) return;
    const index = new Map(this.current.map((r, i) => [this.keyOf(r), i]));
    const next: (T | undefined)[] = [...this.current];
    keys.forEach((key, i) => {
      const row = rows[i];
      const at = index.get(key);
      if (row === undefined) {
        if (at !== undefined) next[at] = undefined; // удалена
      } else if (at !== undefined) next[at] = row; // изменена
      else next.push(row); // новая
    });
    this.set(next.filter((r): r is T => r !== undefined));
  }

  private set(rows: T[]): void {
    this.current = this.prepare(rows);
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }
}

/** Реактивный массив таблицы для React. Ошибка чтения бросается при рендере — её ловит AppErrorBoundary. */
export function useLiveTable<T>(table: TableLike<T>, keyOf: (row: T) => string, prepare?: (rows: T[]) => T[]): readonly T[] | undefined {
  const [store] = useState(() => new LiveTable(table, keyOf, prepare));
  useEffect(() => {
    store.start();
    return () => store.stop();
  }, [store]);
  const value = useSyncExternalStore(store.subscribe, store.getSnapshot);
  if (store.error) throw store.error;
  return value;
}
