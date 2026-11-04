import Dexie, { type EntityTable } from 'dexie';
import type {
  Account,
  Area,
  Category,
  OccurrenceLog,
  Recurring,
  Settings,
  Task,
  TaskEvent,
  Transaction,
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

export const SCHEMA_VERSION = 1;

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

  constructor(name = 'finance') {
    super(name);
    this.version(1).stores(SCHEMA_V1);
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
