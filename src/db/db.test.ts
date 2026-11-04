import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { DEFAULT_SETTINGS, FinanceDB, SCHEMA_V1, SCHEMA_V2, ensureBaseCategories, ensureSettings } from './db';
import { deleteAll, exportAll, replaceAll } from '../data/backup';
import { generateSeed } from '../dev/seedData';

let db: FinanceDB;
let n = 0;

function freshDb(): FinanceDB {
  db = new FinanceDB(`test-${n++}`);
  return db;
}

afterEach(async () => {
  await db?.delete();
});

describe('схема Dexie', () => {
  it('открывается последней версией со всеми таблицами', async () => {
    const d = freshDb();
    await d.open();
    expect(d.verno).toBe(2);
    expect(d.tables.map((t) => t.name).sort()).toEqual(Object.keys(SCHEMA_V2).sort());
  });

  it('миграция v1 → v2: данные прошлой версии на месте, новые таблицы пустые', async () => {
    const name = `test-migrate-${n++}`;
    const seed = generateSeed('2026-11-04');
    const v1 = new Dexie(name);
    v1.version(1).stores(SCHEMA_V1);
    await v1.table('accounts').bulkAdd(seed.accounts);
    await v1.table('categories').bulkAdd(seed.categories);
    await v1.table('transactions').bulkAdd(seed.transactions);
    await v1.table('recurring').bulkAdd(seed.recurring);
    await v1.table('occurrenceLog').bulkAdd(seed.occurrenceLog);
    await v1.table('settings').put(seed.settings);
    await v1.table('tasks').add({ id: 't', title: 'Старая задача', important: false, status: 'open', postponeCount: 2, createdAt: 1 });
    v1.close();

    const d = new FinanceDB(name);
    db = d;
    await d.open();
    expect(d.verno).toBe(2);
    const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
    expect(byId(await d.accounts.toArray())).toEqual(byId(seed.accounts));
    expect(await d.transactions.count()).toBe(seed.transactions.length);
    expect(await d.transactions.where('[type+date]').equals(['expense', seed.transactions.find((t) => t.type === 'expense')!.date]).count()).toBeGreaterThan(0);
    expect(byId(await d.recurring.toArray())).toEqual(byId(seed.recurring));
    expect(await d.settings.get('main')).toEqual(seed.settings);
    expect(await d.tasks.get('t')).toMatchObject({ title: 'Старая задача', postponeCount: 2 });
    expect(await d.habits.count()).toBe(0);
    expect(await d.workoutSets.count()).toBe(0);
    await d.habitLogs.add({ id: 'l', habitId: 'h', date: '2026-11-04', value: 1, at: 1 });
    expect(await d.habitLogs.where('[habitId+date]').equals(['h', '2026-11-04']).count()).toBe(1);
  });

  it('индексы операций и журналов — как в SPEC', async () => {
    const d = freshDb();
    await d.open();
    const idx = (table: string) => d.table(table).schema.indexes.map((i) => i.name).sort();
    expect(idx('transactions')).toEqual(
      ['[type+date]', 'accountId', 'categoryId', 'date', 'recurringId', 'toAccountId'].sort(),
    );
    expect(idx('occurrenceLog')).toEqual(['[recurringId+dueDate]']);
    expect(idx('tasks')).toEqual(['areaId', 'date', 'status']);
    expect(idx('taskEvents')).toEqual(['date', 'taskId', 'type']);
  });

  it('операция сохраняется и находится по [type+date]', async () => {
    const d = freshDb();
    await d.transactions.add({
      id: 't1',
      type: 'expense',
      date: '2026-11-04',
      accountId: 'a1',
      amount: 25_000,
      categoryId: 'c1',
      createdAt: 1,
      updatedAt: 1,
    });
    const found = await d.transactions.where('[type+date]').equals(['expense', '2026-11-04']).toArray();
    expect(found.map((t) => t.id)).toEqual(['t1']);
  });
});

describe('ensureSettings', () => {
  it('создаёт настройки по умолчанию: порог мелких трат 300 сом', async () => {
    const d = freshDb();
    const s = await ensureSettings(d);
    expect(s).toEqual(DEFAULT_SETTINGS);
    expect(s.smallExpenseThreshold).toBe(30_000);
    expect(await d.settings.get('main')).toEqual(DEFAULT_SETTINGS);
  });

  it('не перезаписывает существующие настройки', async () => {
    const d = freshDb();
    await d.settings.add({ ...DEFAULT_SETTINGS, lastUsdtRate: 875_000, theme: 'dark' });
    const s = await ensureSettings(d);
    expect(s.lastUsdtRate).toBe(875_000);
    expect(s.theme).toBe('dark');
  });
});

describe('ensureBaseCategories', () => {
  it('создаёт 13 категорий расходов и 3 дохода один раз', async () => {
    const d = freshDb();
    await ensureBaseCategories(d);
    await ensureBaseCategories(d);
    const all = await d.categories.orderBy('sortOrder').toArray();
    expect(all).toHaveLength(16);
    expect(all.filter((c) => c.kind === 'income').map((c) => c.name)).toEqual(['Зарплата', 'Подработка', 'Другое']);
    expect(all.find((c) => c.name === 'Жильё')?.isFixed).toBe(true);
  });

  it('не трогает существующие (в том числе архивные) категории', async () => {
    const d = freshDb();
    await d.categories.add({ id: 'x', name: 'Своя', kind: 'expense', icon: 'Star', color: '#2448D6', isFixed: false, sortOrder: 0, archived: true });
    await ensureBaseCategories(d);
    expect(await d.categories.count()).toBe(1);
  });
});


describe('бэкап на уровне базы', () => {
  it('экспорт → удалить всё → импорт: все данные на месте (приёмка этапа 7)', async () => {
    const d = freshDb();
    const seed = generateSeed('2026-11-04');
    await d.accounts.bulkAdd(seed.accounts);
    await d.categories.bulkAdd(seed.categories);
    await d.transactions.bulkAdd(seed.transactions);
    await d.recurring.bulkAdd(seed.recurring);
    await d.occurrenceLog.bulkAdd(seed.occurrenceLog);
    await d.settings.put(seed.settings);
    const backup = await exportAll(d);

    await deleteAll(d);
    expect(await d.transactions.count()).toBe(0);
    expect(await d.categories.count()).toBe(16); // базовые категории пересоздаются
    expect(await d.areas.count()).toBe(4);
    await d.areas.clear();

    await replaceAll(JSON.parse(JSON.stringify(backup)), d);
    const again = await exportAll(d);
    expect(again.data).toEqual(backup.data);
  });
});

describe('привычки в базе', () => {
  it('8 × «+1» за день — одна запись со значением 8; переключение отметки', async () => {
    const d = freshDb();
    // Действия работают с общей базой приложения — проверяем на ней же.
    const { db: appDb } = await import('./index');
    const { addHabitCount, toggleHabitDay, getHabitValue } = await import('../data/habits');
    await appDb.habitLogs.clear();
    await Promise.all(Array.from({ length: 8 }, () => addHabitCount('water', '2026-11-04', 1)));
    expect(await getHabitValue('water', '2026-11-04')).toBe(8);
    expect(await appDb.habitLogs.where('[habitId+date]').equals(['water', '2026-11-04']).count()).toBe(1);
    await toggleHabitDay('gym', '2026-11-04');
    expect(await getHabitValue('gym', '2026-11-04')).toBe(1);
    await toggleHabitDay('gym', '2026-11-04');
    expect(await getHabitValue('gym', '2026-11-04')).toBe(0);
    await appDb.delete();
    void d;
  });
});
