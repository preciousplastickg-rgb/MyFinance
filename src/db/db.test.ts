import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, FinanceDB, SCHEMA_V1, ensureSettings } from './db';

let db: FinanceDB;
let n = 0;

function freshDb(): FinanceDB {
  db = new FinanceDB(`test-${n++}`);
  return db;
}

afterEach(async () => {
  await db?.delete();
});

describe('схема Dexie v1', () => {
  it('открывается со всеми таблицами раздела 3', async () => {
    const d = freshDb();
    await d.open();
    expect(d.verno).toBe(1);
    expect(d.tables.map((t) => t.name).sort()).toEqual(Object.keys(SCHEMA_V1).sort());
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
