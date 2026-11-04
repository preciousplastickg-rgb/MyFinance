import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { DEFAULT_SETTINGS, FinanceDB, SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, ensureBaseCategories, ensureSettings } from './db';
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
    expect(d.verno).toBe(4);
    expect(d.tables.map((t) => t.name).sort()).toEqual(Object.keys(SCHEMA_V4).sort());
  });

  it('миграция v2 → v3: курс USDT переезжает в rates.USDT, старые поля и данные на месте', async () => {
    const name = `test-migrate-v3-${n++}`;
    const v2 = new Dexie(name);
    v2.version(1).stores(SCHEMA_V1);
    v2.version(2).stores(SCHEMA_V2);
    const oldSettings = { ...DEFAULT_SETTINGS, lastUsdtRate: 875_000, lastUsdtRateDate: '2026-10-27', lastBackupAt: 123 };
    await v2.table('settings').put(oldSettings);
    await v2.table('accounts').add({ id: 'usdt', name: 'USDT', type: 'crypto', currency: 'USDT', icon: 'Coins', color: '#0E7490', includeInDaily: false, openingBalance: 30_000, openingDate: '2026-08-01', sortOrder: 0, archived: false });
    await v2.table('habits').add({ id: 'h', name: 'Вода', icon: 'Droplet', color: '#0E7490', kind: 'count', target: 8, startDate: '2026-10-01', sortOrder: 0, archived: false });
    v2.close();

    const d = new FinanceDB(name);
    db = d;
    await d.open();
    expect(d.verno).toBe(4);
    expect(await d.settings.get('main')).toEqual({ ...oldSettings, rates: { USDT: { rate: 875_000, date: '2026-10-27' } } });
    expect(await d.accounts.get('usdt')).toMatchObject({ currency: 'USDT', openingBalance: 30_000 });
    expect(await d.habits.get('h')).toMatchObject({ name: 'Вода', target: 8 });
  });

  it('миграция v3 → v4: тренировки остаются, их дни становятся отметками привычки «Спортзал»', async () => {
    const name = `test-migrate-v4-${n++}`;
    const v3 = new Dexie(name);
    v3.version(1).stores(SCHEMA_V1);
    v3.version(2).stores(SCHEMA_V2);
    v3.version(3).stores(SCHEMA_V3);
    const gym = { id: 'gym', name: 'Спортзал', icon: 'Dumbbell', color: '#2448D6', kind: 'weekly', target: 3, workoutType: 'gym', startDate: '2026-10-01', sortOrder: 0, archived: false };
    await v3.table('habits').add(gym);
    await v3.table('habitLogs').add({ id: 'manual', habitId: 'gym', date: '2026-11-03', value: 1, at: 9 });
    const workouts = [
      { id: 'w1', date: '2026-11-02', type: 'gym', createdAt: 1, updatedAt: 1 },
      { id: 'w2', date: '2026-11-03', type: 'gym', createdAt: 2, updatedAt: 2 },
      { id: 'w3', date: '2026-11-04', type: 'pool', distanceM: 1000, durationS: 1920, createdAt: 3, updatedAt: 3 },
    ];
    await v3.table('workouts').bulkAdd(workouts);
    await v3.table('exercises').add({ id: 'ex', name: 'Жим ногами', icon: 'Dumbbell', sortOrder: 0, archived: false });
    await v3.table('workoutSets').add({ id: 's', workoutId: 'w1', exerciseId: 'ex', order: 0, weightG: 80_000, reps: 10 });
    v3.close();

    const d = new FinanceDB(name);
    db = d;
    await d.open();
    expect(d.verno).toBe(4);
    // Тренировки, тренажёры, подходы и поле workoutType — на месте: ничего не удалено.
    expect(await d.workouts.toArray()).toEqual(workouts);
    expect(await d.exercises.count()).toBe(1);
    expect(await d.workoutSets.count()).toBe(1);
    expect(await d.habits.get('gym')).toEqual(gym);
    // 2-е — новая отметка из тренировки; 3-е уже было отмечено вручную; бассейн «Спортзалу» не засчитывается.
    const logs = (await d.habitLogs.toArray()).sort((a, b) => a.date.localeCompare(b.date));
    expect(logs.map((l) => [l.id, l.date])).toEqual([
      ['workout-gym-2026-11-02', '2026-11-02'],
      ['manual', '2026-11-03'],
    ]);
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
    expect(d.verno).toBe(4);
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
