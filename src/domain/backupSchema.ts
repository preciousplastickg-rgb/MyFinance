import { z } from 'zod';
import type { Backup } from './backup';

/**
 * Проверка файла бэкапа (zod). Отдельный модуль: parseBackup подгружает его динамически,
 * чтобы zod (≈90 КБ) не попадал в главный бандл и не замедлял старт — он нужен только при импорте.
 */

const id = z.string().min(1);
const minor = z.number().int();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const currency = z.string().regex(/^[A-Z]{3,5}$/);

const account = z.looseObject({
  id, name: z.string(), type: z.enum(['bank', 'cash', 'crypto', 'savings']), currency, icon: z.string(), color: z.string(),
  includeInDaily: z.boolean(), openingBalance: minor, openingDate: date, sortOrder: z.number(), archived: z.boolean(),
  purpose: z.enum(['savings', 'deposit', 'cash', 'fund']).optional(), goal: minor.positive().optional(), goalDate: date.optional(),
});
const category = z.looseObject({
  id, name: z.string(), kind: z.enum(['expense', 'income']), icon: z.string(), color: z.string(),
  isFixed: z.boolean(), sortOrder: z.number(), archived: z.boolean(), limit: minor.nonnegative().optional(),
});
const transaction = z.looseObject({
  id, type: z.enum(['expense', 'income', 'transfer', 'debt']), date, accountId: id, amount: minor.positive(),
  debtId: id.optional(), flow: z.enum(['out', 'in']).optional(),
  categoryId: id.optional(), toAccountId: id.optional(), toAmount: minor.optional(), rate: z.number().int().optional(),
  origAmount: minor.positive().optional(), origCurrency: currency.optional(),
  note: z.string().optional(), recurringId: id.optional(), dueDate: date.optional(),
  createdAt: z.number(), updatedAt: z.number(),
});
const schedule = z.discriminatedUnion('type', [
  z.object({ type: z.literal('monthly'), day: z.number().int().min(1).max(31) }),
  z.object({ type: z.literal('weekly'), weekday: z.number().int().min(1).max(7) }),
  z.object({ type: z.literal('yearly'), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) }),
]);
// Кредит или рассрочка (этап 29): календарь платежей не пустой, суммы положительные.
const loan = z.looseObject({
  kind: z.enum(['credit', 'installment']), principal: minor.positive(), rate: z.number().int().nonnegative().optional(),
  termMonths: z.number().int().min(1).max(600), firstDate: date, lender: z.string().optional(),
  payments: z.array(z.object({ date, amount: minor.positive() })).min(1),
});
const recurring = z.looseObject({
  id, kind: z.enum(['expense', 'income']), name: z.string(), amount: minor, currency, accountId: id, categoryId: id,
  schedule, isMandatory: z.boolean(), isSubscription: z.boolean(), startDate: date, active: z.boolean(), loan: loan.optional(),
});
const occurrenceLog = z.looseObject({ id, recurringId: id, dueDate: date, status: z.enum(['done', 'skipped']), transactionId: id.optional() });
const settings = z.looseObject({
  key: z.literal('main'), smallExpenseThreshold: minor, theme: z.enum(['light', 'dark', 'system']),
  // Этап 26: оба поля необязательные — бэкап без них импортируется.
  palette: z.enum(['graphite', 'navy', 'espresso']).optional(), fabPosition: z.enum(['left', 'center', 'right']).optional(),
  animations: z.boolean().optional(),
  hideAmounts: z.boolean().optional(),
  rates: z.record(z.string(), z.object({ rate: z.number().int().positive(), date })).optional(),
  lastUsdtRate: z.number().int().optional(), lastUsdtRateDate: date.optional(), lastBackupAt: z.number().optional(),
});
const area = z.looseObject({ id, name: z.string(), icon: z.string(), color: z.string(), sortOrder: z.number(), archived: z.boolean() });
const task = z.looseObject({
  id, title: z.string(), areaId: id.optional(), goalId: id.optional(), icon: z.string().optional(), date: date.optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(), important: z.boolean(), note: z.string().optional(),
  repeat: z
    .discriminatedUnion('type', [
      z.object({ type: z.literal('daily') }),
      z.object({ type: z.literal('weekly'), weekdays: z.array(z.number().int().min(1).max(7)) }),
      z.object({ type: z.literal('monthly'), day: z.number().int().min(1).max(31) }),
    ])
    .optional(),
  status: z.enum(['open', 'done', 'deleted']), postponeCount: z.number().int(), createdAt: z.number(), doneAt: z.number().optional(),
  deadline: date.optional(), cost: minor.nonnegative().optional(), costCurrency: currency.optional(),
});
const taskEvent = z.looseObject({
  id, taskId: id, type: z.enum(['created', 'done', 'undone', 'postponed', 'deleted']), date,
  fromDate: date.optional(), toDate: date.optional(), at: z.number(),
});

const habit = z.looseObject({
  id, name: z.string(), icon: z.string(), color: z.string(), kind: z.enum(['daily', 'weekly', 'count', 'abstain']),
  days: z.array(z.number().int().min(1).max(7)).optional(), note: z.string().optional(), goalId: id.optional(), watchCategoryId: id.optional(),
  legacyKind: z.enum(['weekly', 'count', 'abstain']).optional(),
  target: z.number().int().positive().optional(), unit: z.string().optional(), workoutType: z.enum(['gym', 'pool', 'any']).optional(),
  startDate: date, sortOrder: z.number(), archived: z.boolean(),
});
const habitLog = z.looseObject({ id, habitId: id, date, value: z.number().int(), at: z.number() });
const debt = z.looseObject({
  id, direction: z.enum(['owedToMe', 'iOwe']), person: z.string(), currency, opening: minor.nonnegative(), date,
  dueDate: date.optional(), note: z.string().optional(), closedAt: z.number().optional(), createdAt: z.number(),
});
const goal = z.looseObject({
  id, name: z.string(), icon: z.string(), color: z.string(), dueDate: date.optional(), jarAccountId: id.optional(), createdAt: z.number(), archived: z.boolean().optional(),
  sortOrder: z.number().optional(),
});
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
    debts: z.array(debt).default([]),
    goals: z.array(goal).default([]),
  }).superRefine((d, ctx) => {
    // Ссылки между таблицами: операция на несуществующий счёт сломала бы балансы молча.
    const accounts = new Set(d.accounts.map((a) => a.id));
    const workouts = new Set(d.workouts.map((w) => w.id));
    const debts = new Set(d.debts.map((x) => x.id));
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    d.transactions.forEach((t, i) => {
      if (!accounts.has(t.accountId)) issue(['transactions', i, 'accountId'], 'счёт не найден');
      if (t.type === 'transfer' && !t.toAccountId) issue(['transactions', i, 'toAccountId'], 'у перевода нет счёта-получателя');
      if (t.toAccountId && !accounts.has(t.toAccountId)) issue(['transactions', i, 'toAccountId'], 'счёт не найден');
      if (t.type === 'debt' && (!t.debtId || !debts.has(t.debtId) || !t.flow)) issue(['transactions', i, 'debtId'], 'долг не найден');
    });
    d.recurring.forEach((r, i) => {
      if (!accounts.has(r.accountId)) issue(['recurring', i, 'accountId'], 'счёт не найден');
    });
    d.workoutSets.forEach((w, i) => {
      if (!workouts.has(w.workoutId)) issue(['workoutSets', i, 'workoutId'], 'тренировка не найдена');
    });
  }),
});

export type ValidateResult = { ok: true; backup: Backup } | { ok: false; error: string };

/** Проверяет уже мигрированный до текущей схемы объект. */
export function validateBackup(migrated: Record<string, unknown>): ValidateResult {
  const parsed = backupSchema.safeParse(migrated);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Файл повреждён: ${issue?.path.join('.') ?? ''} — ${issue?.message ?? 'ошибка формата'}` };
  }
  return { ok: true, backup: parsed.data as unknown as Backup };
}
