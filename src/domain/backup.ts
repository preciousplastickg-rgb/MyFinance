import { diffDays, formatShortDate, toLocalDate } from './date';
import { plural } from './money';
import { migrateHabitsV5 } from './habitMigration';
import { migrateSettingsV3 } from './settingsMigration';
import { workoutHabitLogs } from './workoutMigration';
import { migrateColor } from './colorMigration';
import type {
  Account, Area, Category, Debt, Exercise, Goal, Habit, HabitLog, LocalDate, OccurrenceLog, Recurring, Settings, Task, TaskEvent,
  Transaction, Workout, WorkoutSet,
} from './types';

export const BACKUP_SCHEMA_VERSION = 9;

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
  debts: Debt[];
  goals: Goal[];
}

export interface Backup {
  app: 'myfinance';
  schemaVersion: number;
  exportedAt: number;
  data: BackupTables;
}

export const TABLE_NAMES = [
  'accounts', 'categories', 'transactions', 'recurring', 'occurrenceLog', 'settings', 'areas', 'tasks', 'taskEvents',
  'habits', 'habitLogs', 'exercises', 'workouts', 'workoutSets', 'debts', 'goals',
] as const;

export function backupFileName(date: LocalDate): string {
  return `finance-backup-${date}.json`;
}

export function buildBackup(data: BackupTables, now: number): Backup {
  return { app: 'myfinance', schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: now, data };
}


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
  // v3 → v4: тренировки убраны — дни тренировок становятся отметками привычек; таблицы тренировок остаются.
  3: (raw) => {
    const data = raw.data as { habits?: Habit[]; habitLogs?: HabitLog[]; workouts?: Workout[] };
    const added = workoutHabitLogs(data.habits ?? [], data.habitLogs ?? [], data.workouts ?? []);
    return { ...raw, data: { ...data, habitLogs: [...(data.habitLogs ?? []), ...added] } };
  },
  // v4 → v5: привычки — галочки с расписанием; «дни без» отмечены по день экспорта, записи не удаляются.
  4: (raw) => {
    const data = raw.data as { habits?: Habit[]; habitLogs?: HabitLog[] };
    const at = Number(raw.exportedAt);
    if (!Number.isFinite(at)) throw new Error('Файл повреждён: нет даты экспорта');
    const m = migrateHabitsV5(data.habits ?? [], data.habitLogs ?? [], toLocalDate(at), at);
    const changed = new Map(m.changedLogs.map((l) => [l.id, l]));
    const habitLogs = (data.habitLogs ?? []).map((l) => changed.get(l.id) ?? l);
    return { ...raw, data: { ...data, habits: m.habits, habitLogs: [...habitLogs, ...m.addedLogs] } };
  },
  // v5 → v6: появились долги — пустая таблица.
  5: (raw) => ({ ...raw, data: { debts: [], ...(raw.data as object) } }),
  // v6 → v7: появились копилки — новый тип счёта; старые данные без изменений.
  6: (raw) => raw,
  // v8 → v9: появились цели — пустая таблица.
  8: (raw) => ({ ...raw, data: { goals: [], ...(raw.data as object) } }),
  // v7 → v8: цвета — имена токенов вместо hex (редизайн).
  7: (raw) => {
    const data = raw.data as Record<string, unknown>;
    const out: Record<string, unknown> = { ...data };
    for (const table of ['accounts', 'categories', 'areas', 'habits']) {
      const rows = data[table];
      if (Array.isArray(rows)) out[table] = rows.map((r: { color?: unknown }) => (typeof r.color === 'string' ? { ...r, color: migrateColor(r.color) } : r));
    }
    return { ...raw, data: out };
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

export async function parseBackup(text: string): Promise<ParseResult> {
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
  // Схема zod — отдельный чанк: грузится при первом импорте бэкапа, а не при старте приложения.
  const { validateBackup } = await import('./backupSchema');
  const checked = validateBackup(migrated);
  if (!checked.ok) return checked;
  return { ok: true, backup: checked.backup, summary: backupSummary(checked.backup) };
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
const TYPE_LABEL: Record<Transaction['type'], string> = { expense: 'расход', income: 'доход', transfer: 'перевод', debt: 'долг' };

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
