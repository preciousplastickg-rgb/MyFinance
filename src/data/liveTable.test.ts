import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { FinanceDB } from '../db/db';
import type { Transaction } from '../domain/types';
import { LiveTable } from './liveTable';

let db: FinanceDB;
let n = 0;
afterEach(async () => {
  await db?.delete();
});

const tx = (i: number, amount = 100): Transaction => ({
  id: `t${i}`, type: 'expense', date: '2026-11-04', accountId: 'a', amount, createdAt: i, updatedAt: i,
});

/** Событие storagemutated приходит после коммита, чуть позже промиса записи — ждём, пока массив не станет таким, как надо. */
async function until(cond: () => boolean): Promise<void> {
  for (let i = 0; i < 400 && !cond(); i++) await new Promise((r) => setTimeout(r, 5));
  expect(cond()).toBe(true);
}

describe('LiveTable — массив таблицы с точечным обновлением', () => {
  it('добавление, правка и удаление дочитываются по ключам; массовые изменения — перечиткой', async () => {
    db = new FinanceDB(`live-${n++}`);
    await db.transactions.bulkAdd([tx(1), tx(2)]);
    const live = new LiveTable<Transaction>(db.transactions, (t) => t.id, (rows) => rows.sort((a, b) => a.createdAt - b.createdAt));
    live.start();
    await live.whenIdle();
    expect(live.current?.map((t) => t.id)).toEqual(['t1', 't2']);
    const first = live.current;

    await db.transactions.add(tx(3));
    await until(() => live.current?.length === 3);
    expect(live.current).not.toBe(first); // новый массив — React увидит изменение
    expect(live.current?.map((t) => t.id)).toEqual(['t1', 't2', 't3']);

    await db.transactions.update('t2', { amount: 555 });
    await until(() => live.current?.find((t) => t.id === 't2')?.amount === 555);

    await db.transactions.delete('t1');
    await until(() => live.current?.length === 2);
    expect(live.current?.map((t) => t.id)).toEqual(['t2', 't3']);

    // Одной транзакцией: добавить и удалить — оба ключа в одном событии.
    await db.transaction('rw', db.transactions, async () => {
      await db.transactions.add(tx(4));
      await db.transactions.delete('t3');
    });
    await until(() => live.current?.map((t) => t.id).join() === 't2,t4');

    // 60 строк разом: Dexie не перечисляет ключи — полная перечитка.
    await db.transactions.bulkAdd(Array.from({ length: 60 }, (_, i) => tx(100 + i)));
    await until(() => live.current?.length === 62);

    await db.transactions.clear();
    await until(() => live.current?.length === 0);

    live.stop();
    await db.transactions.add(tx(9));
    await new Promise((r) => setTimeout(r, 30));
    expect(live.current?.length).toBe(0); // после stop не слушаем
  });

  it('запись в другую таблицу массив не трогает', async () => {
    db = new FinanceDB(`live-${n++}`);
    await db.transactions.add(tx(1));
    const live = new LiveTable<Transaction>(db.transactions, (t) => t.id);
    live.start();
    await live.whenIdle();
    const before = live.current;
    await db.habitLogs.add({ id: 'h', habitId: 'x', date: '2026-11-04', value: 1, at: 1 });
    await new Promise((r) => setTimeout(r, 30));
    await live.whenIdle();
    expect(live.current).toBe(before);
    live.stop();
  });
});
