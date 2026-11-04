import { addDays, daysInMonth, makeDate, parseLocalDate, weekdayOf, type MonthKey } from './date';
import { occurrenceDates, type Occurrence } from './recurring';
import { dayStats } from './tasks';
import type { HabitLog, LocalDate, OccurrenceLog, Recurring, Task, TaskEvent, Transaction } from './types';

/** Сетка месяца для календаря: недели пн–вс, пустые клетки до 1-го и после последнего числа — null. */
export function monthGrid(month: MonthKey): (LocalDate | null)[][] {
  const { year, month: m } = parseLocalDate(`${month}-01`);
  const first = makeDate(year, m, 1);
  const days = daysInMonth(year, m);
  const cells: (LocalDate | null)[] = Array.from({ length: weekdayOf(first) - 1 }, () => null);
  for (let d = 0; d < days; d++) cells.push(addDays(first, d));
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

/** Регулярные платежи и доходы с датой в этот день и что с ними сделано — для любого дня, не только окна «Сегодня». */
export function dayPayments(recurring: readonly Recurring[], logs: readonly OccurrenceLog[], date: LocalDate): Occurrence[] {
  const status = new Map(logs.map((l) => [`${l.recurringId}|${l.dueDate}`, l.status]));
  return recurring
    .filter((r) => r.active && occurrenceDates(r, date, date).length > 0)
    .map((r) => {
      const key = `${r.id}|${date}`;
      return { recurring: r, dueDate: date, status: status.get(key) ?? ('pending' as const), key };
    })
    .sort((a, b) => (a.recurring.kind === b.recurring.kind ? a.recurring.name.localeCompare(b.recurring.name) : a.recurring.kind === 'income' ? -1 : 1));
}

/** Дела дня: что сделано в этот день (по журналу) и что на этот день назначено и ещё открыто. */
export function dayTasks(tasks: readonly Task[], events: readonly TaskEvent[], date: LocalDate): { done: Task[]; open: Task[] } {
  const doneIds = dayStats(tasks, events).done.get(date) ?? new Set();
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const done = [...doneIds].map((id) => byId.get(id)).filter((t): t is Task => !!t && t.status !== 'deleted');
  const open = tasks.filter((t) => t.status === 'open' && t.date === date && !doneIds.has(t.id));
  return { done, open };
}

/** Дни месяца, в которые что-то было: операции, сделанные дела, отметки привычек — точки в календаре. */
export function activeDays(
  month: MonthKey,
  transactions: readonly Pick<Transaction, 'date'>[],
  events: readonly Pick<TaskEvent, 'date' | 'type'>[],
  habitLogs: readonly Pick<HabitLog, 'date' | 'value'>[],
): Set<LocalDate> {
  const out = new Set<LocalDate>();
  const add = (d: LocalDate) => d.startsWith(month) && out.add(d);
  for (const t of transactions) add(t.date);
  for (const e of events) if (e.type === 'done') add(e.date);
  for (const l of habitLogs) if (l.value > 0) add(l.date); // 0 — сохранённый срыв «дней без» (v5)
  return out;
}
