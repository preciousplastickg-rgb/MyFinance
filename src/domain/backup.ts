import { z } from 'zod';
import { diffDays, formatShortDate, toLocalDate } from './date';
import { plural } from './money';
import { migrateSettingsV3 } from './settingsMigration';
import type {
  Account, Area, Category, Exercise, Habit, HabitLog, LocalDate, OccurrenceLog, Recurring, Settings, Task, TaskEvent,
  Transaction, Workout, WorkoutSet,
} from './types';

export const BACKUP_SCHEMA_VERSION = 3;

export interface BackupTables {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurring: Recurring[];
  occurrenceLog: OccurrenceLog[];
  settings: Settings[];
  areas: Area[];
  tasks: Task[];
  taskEvents: TaskEvent[];
  habits: Habit[];
  habitLogs: HabitLog[];
  exercises: Exercise[];
  workouts: Workout[];
  workoutSets: WorkoutSet[];
}

export interface Backup {
  app: 'myfinance';
  schemaVersion: number;
  exportedAt: number;
  data: BackupTables;
}

export const TABLE_NAMES = [
  'accounts', 'categories', 'transactions', 'recurring', 'occurrenceLog', 'settings', 'areas', 'tasks', 'taskEvents',
  'habits', 'habitLogs', 'exercises', 'workouts', 'workoutSets',
] as const;

export function backupFileName(date: LocalDate): string {
  return `finance-backup-${date}.json`;
}

export function buildBackup(data: BackupTables, now: number): Backup {
  return { app: 'myfinance', schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: now, data };
}

// ── Проверка импорта (zod) ──────────────────────────────
// Неизвестные поля сохраняются (passthrough): импорт ничего не выбрасывает из данных.

const id = z.string().min(1);
const minor = z.number().int();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const currency = z.string().regex(/^[A-Z]{3,5}$/);

const account = z.looseObject({
  id, name: z.string(), type: z.enum(['bank', 'cash', 'crypto']), currency, icon: z.string(), color: z.string(),
  includeInDaily: z.boolean(), openingBalance: minor, openingDate: date, sortOrder: z.number(), archived: z.boolean(),
});
const category = z.looseObject({
  id, name: z.string(), kind: z.enum(['expense', 'income']), icon: z.string(), color: z.string(),
  isFixed: z.boolean(), sortOrder: z.number(), archived: z.boolean(),
});
const transaction = z.looseObject({
  id, type: z.enum(['expense', 'income', 'transfer']), date, accountId: id, amount: minor.positive(),
  categoryId: id.optional(), toAccountId: id.optional(), toAmount: minor.optional(), rate: z.number().int().optional(),
  note: z.string().optional(), recurringId: id.optional(), dueDate: date.optional(),
  createdAt: z.number(), updatedAt: z.number(),
});
const schedule = z.discriminatedUnion('type', [
  z.object({ type: z.literal('monthly'), day: z.number().int().min(1).max(31) }),
  z.object({ type: z.literal('weekly'), weekday: z.number().int().min(1).max(7) }),
  z.object({ type: z.literal('yearly'), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) }),
]);
const recurring = z.looseObject({
  id, kind: z.enum(['expense', 'income']), name: z.string(), amount: minor, currency, accountId: id, categoryId: id,
  schedule, isMandatory: z.boolean(), isSubscription: z.boolean(), startDate: date, active: z.boolean(),
});
const occurrenceLog = z.looseObject({ id, recurringId: id, dueDate: date, status: z.enum(['done', 'skipped']), transactionId: id.optional() });
const settings = z.looseObject({
  key: z.literal('main'), smallExpenseThreshold: minor, theme: z.enum(['light', 'dark', 'system']),
  rates: z.record(z.string(), z.object({ rate: z.number().int().positive(), date })).optional(),
  lastUsdtRate: z.number().int().optional(), lastUsdtRateDate: date.optional(), lastBackupAt: z.number().optional(),
});
const area = z.looseObject({ id, name: z.string(), icon: z.string(), color: z.string(), sortOrder: z.number(), archived: z.boolean() });
const task = z.looseObject({
  id, title: z.string(), areaId: id.optional(), icon: z.string().optional(), date: date.optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(), important: z.boolean(), note: z.string().optional(),
  repeat: z
    .discriminatedUnion('type', [
      z.object({ type: z.literal('daily') }),
      z.object({ type: z.literal('weekly'), weekdays: z.array(z.number().int().min(1).max(7)) }),
      z.object({ type: z.literal('monthly'), day: z.number().int().min(1).max(31) }),
    ])
    .optional(),
  status: z.enum(['open', 'done', 'deleted']), postponeCount: z.number().int(), createdAt: z.number(), doneAt: z.number().optional(),
});
const taskEvent = z.looseObject({
  id, taskId: id, type: z.enum(['created', 'done', 'undone', 'postponed', 'deleted']), date,
  fromDate: date.optional(), toDate: date.optional(), at: z.number(),
});

const habit = z.looseObject({
  id, name: z.string(), icon: z.string(), color: z.string(), kind: z.enum(['daily', 'weekly', 'count', 'abstain']),
  target: z.number().int().positive().optional(), unit: z.string().optional(), workoutType: z.enum(['gym', 'pool', 'any']).optional(),
  startDate: date, sortOrder: z.number(), archived: z.boolean(),
});
const habitLog = z.looseObject({ id, habitId: id, date, value: z.number().int(), at: z.number() });
const exercise = z.looseObject({ id, name: z.string(), icon: z.string(), sortOrder: z.number(), archived: z.boolean() });
const workout = z.looseObject({
  id, date, type: z.enum(['gym', 'pool']), distanceM: z.number().int().nonnegative().optional(),
  durationS: z.number().int().nonnegative().optional(), note: z.string().optional(), createdAt: z.number(), updatedAt: z.number(),
});
const workoutSet = z.looseObject({
  id, workoutId: id, exerciseId: id, order: z.number().int(), weightG: z.number().int().nonnegative(), reps: z.number().int().nonnegative(),
});

const backupSchema = z.object({
  app: z.literal('myfinance'),
  schemaVersion: z.number().int().min(1),
  exportedAt: z.number(),
  data: z.object({
    accounts: z.array(account),
    categories: z.array(category),
    transactions: z.array(transaction),
    recurring: z.array(recurring).default([]),
    occurrenceLog: z.array(occurrenceLog).default([]),
    settings: z.array(settings).max(1).default([]),
    areas: z.array(area).default([]),
    tasks: z.array(task).default([]),
    taskEvents: z.array(taskEvent).default([]),
    habits: z.array(habit).default([]),
    habitLogs: z.array(habitLog).default([]),
    exercises: z.array(exercise).default([]),
    workouts: z.array(workout).default([]),
    workoutSets: z.array(workoutSet).default([]),
  }),
});

/**
 * Миграции файлов старых версий: те же шаги, что и у схемы Dexie (SPEC 8).
 * Ключ — версия, ИЗ которой мигрируем. Шаги только добавляют, ничего не удаляют.
 */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // v1 → v2: появились привычки и тренировки — пустые таблицы, старые данные без изменений.
  1: (raw) => ({
    ...raw,
    data: { habits: [], habitLogs: [], exercises: [], workouts: [], workoutSets: [], ...(raw.data as object) },
  }),
  // v2 → v3: курс USDT переезжает в rates.USDT, старые поля остаются.
  2: (raw) => {
    const data = raw.data as { settings?: Record<string, unknown>[] };
    return { ...raw, data: { ...data, settings: (data.settings ?? []).map((s) => migrateSettingsV3(s as Partial<Settings>)) } };
  },
};

export function migrateBackup(raw: Record<string, unknown>): Record<string, unknown> {
  let current = raw;
  let version = Number(current.schemaVersion);
  while (version < BACKUP_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`Нет миграции со схемы v${version}`);
    current = { ...step(current), schemaVersion: version + 1 };
    version++;
  }
  return current;
}

export type ParseResult =
  | { ok: true; backup: Backup; summary: string }
  | { ok: false; error: string };

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Это не JSON-файл' };
  }
  if (!raw || typeof raw !== 'object' || (raw as { app?: unknown }).app !== 'myfinance') {
    return { ok: false, error: 'Это не бэкап этого приложения' };
  }
  const version = Number((raw as { schemaVersion?: unknown }).schemaVersion);
  if (version > BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: `Бэкап из более новой версии приложения (схема v${version}). Обновите приложение.` };
  }
  let migrated: Record<string, unknown>;
  try {
    migrated = migrateBackup(raw as Record<string, unknown>);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = backupSchema.safeParse(migrated);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Файл повреждён: ${issue?.path.join('.') ?? ''} — ${issue?.message ?? 'ошибка формата'}` };
  }
  const backup = parsed.data as unknown as Backup;
  return { ok: true, backup, summary: backupSummary(backup) };
}

/** «Счетов 5, операций 1 240, задач 86, бэкап от 2 ноября». */
export function backupSummary(b: Backup): string {
  const n = (v: number) => v.toLocaleString('ru-RU').replace(/\s/g, ' ');
  return `Счетов ${n(b.data.accounts.length)}, операций ${n(b.data.transactions.length)}, задач ${n(
    b.data.tasks.filter((t) => t.status !== 'deleted').length,
  )}, бэкап от ${formatShortDate(toLocalDate(b.exportedAt))}`;
}

// ── CSV для Excel ───────────────────────────────────────

const CSV_COLUMNS = ['дата', 'тип', 'сумма', 'валюта', 'счёт', 'категория', 'счёт_получатель', 'сумма_зачисления', 'курс', 'комментарий'];
const TYPE_LABEL: Record<Transaction['type'], string> = { expense: 'расход', income: 'доход', transfer: 'перевод' };

/** 1 750 000 → «17500,00»; курс 875 000 → «87,5000». */
function decimal(value: number, scale: number): string {
  const neg = value < 0;
  const abs = Math.abs(value);
  const digits = String(scale).length - 1;
  const whole = Math.floor(abs / scale);
  const frac = String(abs % scale).padStart(digits, '0');
  return `${neg ? '-' : ''}${whole},${frac}`;
}

function cell(v: string): string {
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** UTF-8 с BOM, разделитель «;», суммы с десятичной запятой (SPEC 8). */
export function transactionsCsv(transactions: readonly Transaction[], accounts: readonly Account[], categories: readonly Category[]): string {
  const acc = new Map(accounts.map((a) => [a.id, a]));
  const cat = new Map(categories.map((c) => [c.id, c]));
  const rows = [...transactions]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt))
    .map((t) => {
      const from = acc.get(t.accountId);
      const to = t.toAccountId ? acc.get(t.toAccountId) : undefined;
      return [
        t.date,
        TYPE_LABEL[t.type],
        decimal(t.amount, 100),
        from?.currency ?? '',
        from?.name ?? '',
        t.categoryId ? (cat.get(t.categoryId)?.name ?? '') : '',
        to?.name ?? '',
        t.type === 'transfer' ? decimal(t.toAmount ?? t.amount, 100) : '',
        t.rate ? decimal(t.rate, 10_000) : '',
        t.note ?? '',
      ].map(cell).join(';');
    });
  return '﻿' + [CSV_COLUMNS.join(';'), ...rows].join('\r\n') + '\r\n';
}

// ── Баннер на «Сегодня» ─────────────────────────────────

const DAY = 86_400_000;

/** Есть хотя бы 20 операций, и бэкапа не было или он старше 7 дней; закрыть можно на 24 часа (SPEC 8). */
export function backupBanner(p: {
  transactionCount: number;
  lastBackupAt?: number;
  hiddenUntil?: number;
  now: number;
}): { show: false } | { show: true; text: string } {
  if (p.transactionCount < 20) return { show: false };
  if (p.hiddenUntil && p.hiddenUntil > p.now) return { show: false };
  if (p.lastBackupAt && p.now - p.lastBackupAt <= 7 * DAY) return { show: false };
  if (!p.lastBackupAt) return { show: true, text: 'Бэкапа ещё не было' };
  const days = diffDays(toLocalDate(p.lastBackupAt), toLocalDate(p.now));
  return { show: true, text: `Последний бэкап ${days} ${plural(days, ['день', 'дня', 'дней'])} назад` };
}
