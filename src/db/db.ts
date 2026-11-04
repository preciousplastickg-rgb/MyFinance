import Dexie, { type EntityTable } from 'dexie';
import { BASE_AREAS, BASE_CATEGORIES } from '../domain/catalog';
import { migrateSettingsV3 } from '../domain/settingsMigration';
import type {
  Account,
  Area,
  Category,
  Exercise,
  Habit,
  HabitLog,
  OccurrenceLog,
  Recurring,
  Settings,
  Task,
  TaskEvent,
  Transaction,
  Workout,
  WorkoutSet,
} from '../domain/types';

// Схема версионируется: любое изменение — новый db.version(n) с недеструктивной
// миграцией и тестом на данных прошлой версии. Старые версии не редактировать.
export const SCHEMA_V1 = {
  accounts: 'id, sortOrder',
  categories: 'id, kind, sortOrder',
  transactions: 'id, date, accountId, toAccountId, categoryId, recurringId, [type+date]',
  recurring: 'id, kind',
  occurrenceLog: 'id, [recurringId+dueDate]',
  settings: 'key',
  areas: 'id, sortOrder',
  tasks: 'id, status, date, areaId',
  taskEvents: 'id, taskId, date, type',
} as const;

/** v2: привычки и тренировки (фаза 2b). Только новые таблицы — данные v1 не трогаются. */
export const SCHEMA_V2 = {
  ...SCHEMA_V1,
  habits: 'id, sortOrder',
  habitLogs: 'id, habitId, date, [habitId+date]',
  exercises: 'id, sortOrder',
  workouts: 'id, date, type',
  workoutSets: 'id, workoutId, exerciseId',
} as const;

/** v3: курсы по каждой валюте (SPEC 4.6). Индексы те же; данные — перенос lastUsdtRate в rates.USDT. */
export const SCHEMA_V3 = SCHEMA_V2;

export const SCHEMA_VERSION = 3;



export const DEFAULT_SETTINGS: Settings = {
  key: 'main',
  smallExpenseThreshold: 30_000, // 300 сом
  theme: 'system',
};

export class FinanceDB extends Dexie {
  accounts!: EntityTable<Account, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  recurring!: EntityTable<Recurring, 'id'>;
  occurrenceLog!: EntityTable<OccurrenceLog, 'id'>;
  settings!: EntityTable<Settings, 'key'>;
  areas!: EntityTable<Area, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  taskEvents!: EntityTable<TaskEvent, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  habitLogs!: EntityTable<HabitLog, 'id'>;
  exercises!: EntityTable<Exercise, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  workoutSets!: EntityTable<WorkoutSet, 'id'>;

  constructor(name = 'finance') {
    super(name);
    this.version(1).stores(SCHEMA_V1);
    this.version(2).stores(SCHEMA_V2);
    this.version(3)
      .stores(SCHEMA_V3)
      .upgrade(async (tx) => {
        const settings = await tx.table('settings').get('main');
        if (settings) await tx.table('settings').put(migrateSettingsV3(settings));
      });
  }
}

/** Создаёт запись настроек, если её нет. Существующую не трогает. */
export async function ensureSettings(database: FinanceDB): Promise<Settings> {
  return database.transaction('rw', database.settings, async () => {
    const existing = await database.settings.get('main');
    if (existing) return existing;
    await database.settings.add(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  });
}

/** Базовые категории создаются сразу при первом запуске (SPEC 5.5). Если категории уже есть — ничего не делает. */
export async function ensureBaseCategories(database: FinanceDB): Promise<void> {
  await database.transaction('rw', database.categories, async () => {
    if ((await database.categories.count()) > 0) return;
    await database.categories.bulkAdd(
      BASE_CATEGORIES.map((c, i) => ({
        ...c,
        id: crypto.randomUUID(),
        sortOrder: i,
        archived: false,
      })),
    );
  });
}

/** Базовые сферы для дел (фаза 2). Если сферы уже есть — ничего не делает. */
export async function ensureBaseAreas(database: FinanceDB): Promise<void> {
  await database.transaction('rw', database.areas, async () => {
    if ((await database.areas.count()) > 0) return;
    await database.areas.bulkAdd(BASE_AREAS.map((a, i) => ({ ...a, id: crypto.randomUUID(), sortOrder: i, archived: false })));
  });
}
