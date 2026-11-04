import { mulDivRound, floorDiv } from './arith';
import { addDays, clampedDate, diffDays, endOfMonth, parseLocalDate, weekdayOf } from './date';
import { usdtToKgs } from './rate';
import type { Account, Id, LocalDate, Minor, OccurrenceLog, Rate, Recurring, RecurringSchedule, Transaction } from './types';

const WEEKDAYS_PLURAL = ['понедельникам', 'вторникам', 'средам', 'четвергам', 'пятницам', 'субботам', 'воскресеньям'];
const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** «10-го числа», «по понедельникам», «1 марта каждый год». */
export function describeSchedule(s: RecurringSchedule): string {
  if (s.type === 'monthly') return `${s.day}-го числа`;
  if (s.type === 'weekly') return `по ${WEEKDAYS_PLURAL[s.weekday - 1]}`;
  return `${s.day} ${MONTHS_GENITIVE[s.month - 1]} каждый год`;
}

/** Даты наступлений в [from; to], не раньше startDate. День 29–31 в коротком месяце — последний день. */
export function occurrenceDates(r: Pick<Recurring, 'schedule' | 'startDate'>, from: LocalDate, to: LocalDate): LocalDate[] {
  const start = r.startDate > from ? r.startDate : from;
  if (start > to) return [];
  const s = r.schedule;
  const out: LocalDate[] = [];
  if (s.type === 'weekly') {
    let d = addDays(start, (s.weekday - weekdayOf(start) + 7) % 7);
    while (d <= to) {
      out.push(d);
      d = addDays(d, 7);
    }
    return out;
  }
  const a = parseLocalDate(start);
  const b = parseLocalDate(to);
  for (let y = a.year; y <= b.year; y++) {
    for (let m = 1; m <= 12; m++) {
      if (s.type === 'yearly' && m !== s.month) continue;
      const d = clampedDate(y, m, s.day);
      if (d >= start && d <= to) out.push(d);
    }
  }
  return out;
}

export interface Occurrence {
  recurring: Recurring;
  dueDate: LocalDate;
  status: 'pending' | 'done' | 'skipped';
  key: string;
}

/** Наступления не хранятся: генерируются на лету для окна [сегодня − 31; сегодня + 62] (SPEC 4.3). */
export function occurrences(recurring: readonly Recurring[], logs: readonly OccurrenceLog[], today: LocalDate): Occurrence[] {
  const from = addDays(today, -31);
  const to = addDays(today, 62);
  const status = new Map<string, OccurrenceLog['status']>();
  for (const l of logs) status.set(`${l.recurringId}|${l.dueDate}`, l.status);
  const out: Occurrence[] = [];
  for (const r of recurring) {
    if (!r.active) continue;
    for (const dueDate of occurrenceDates(r, from, to)) {
      const key = `${r.id}|${dueDate}`;
      out.push({ recurring: r, dueDate, status: status.get(key) ?? 'pending', key });
    }
  }
  return out.sort((x, y) => (x.dueDate < y.dueDate ? -1 : x.dueDate > y.dueDate ? 1 : x.recurring.name.localeCompare(y.recurring.name)));
}

/** Ожидаемая сумма в сомах; USDT — по последнему курсу, без курса не учитывается. */
export function expectedKgs(r: Recurring, rate: Rate | undefined): Minor {
  if (r.currency === 'KGS') return r.amount;
  return rate ? usdtToKgs(r.amount, rate) : 0;
}

export interface DailyLimitInput {
  today: LocalDate;
  accounts: readonly Account[];
  balances: ReadonlyMap<Id, Minor>;
  transactions: readonly Transaction[];
  occurrences: readonly Occurrence[];
  usdtRate?: Rate;
}

export interface DailyLimit {
  /** D — дней до поступления (сегодня включительно, день поступления исключительно), не меньше 1. */
  days: number;
  spentToday: Minor; // S
  startOfDay: Minor; // B
  mandatory: Minor; // M
  free: Minor; // B − M
  limit: Minor; // floor((B − M) / (D × 10)) × 10 сом
  left: Minor; // limit − S
  /** Ближайшее ожидаемое поступление; нет — горизонт до конца месяца. */
  income?: Occurrence;
  horizon: LocalDate;
  status: 'ok' | 'overspent' | 'shortfall';
  /** Обязательные платежи до поступления, которые вошли в M. */
  mandatoryItems: Occurrence[];
}

/**
 * Лимит на день (SPEC 4.4).
 * Ближайшее поступление — первое неотмеченное наступление активного дохода строго после сегодня:
 * неотмеченная сегодняшняя или просроченная зарплата висит карточкой «Пришло?», а лимит не отдаёт всё за один день.
 */
export function dailyLimit(input: DailyLimitInput): DailyLimit {
  const { today, accounts, balances, transactions, occurrences: occ, usdtRate } = input;
  const income = occ.find((o) => o.recurring.kind === 'income' && o.status === 'pending' && o.dueDate > today);
  const horizon = income ? income.dueDate : addDays(endOfMonth(today), 1);
  const days = Math.max(1, diffDays(today, horizon));

  const daily = new Map(accounts.filter((a) => a.includeInDaily && !a.archived).map((a) => [a.id, a]));
  const toKgs = (a: Account, v: Minor) => (a.currency === 'KGS' ? v : usdtRate ? usdtToKgs(v, usdtRate) : 0);

  let spentToday = 0;
  for (const t of transactions) {
    const a = daily.get(t.accountId);
    if (a && t.type === 'expense' && t.date === today && !t.recurringId) spentToday += toKgs(a, t.amount);
  }
  let current = 0;
  for (const a of daily.values()) current += toKgs(a, balances.get(a.id) ?? 0);
  const startOfDay = current + spentToday;

  const mandatoryItems = occ.filter(
    (o) => o.recurring.kind === 'expense' && o.recurring.isMandatory && o.status === 'pending' && o.dueDate < horizon,
  );
  let mandatory = 0;
  for (const o of mandatoryItems) mandatory += expectedKgs(o.recurring, usdtRate);

  const free = startOfDay - mandatory;
  const limit = free > 0 ? floorDiv(free, days * 1_000) * 1_000 : 0;
  const left = limit - spentToday;
  const status = free <= 0 ? 'shortfall' : left < 0 ? 'overspent' : 'ok';
  return { days, spentToday, startOfDay, mandatory, free, limit, left, income, horizon, status, mandatoryItems };
}

/** Платежи до поступления (включая просроченные) и доходы, которые пора отметить (SPEC 5.1 п. 5). */
export function todayAgenda(occ: readonly Occurrence[], today: LocalDate, horizon: LocalDate) {
  const payments = occ.filter((o) => o.recurring.kind === 'expense' && o.status === 'pending' && o.dueDate < horizon);
  const incomes = occ.filter((o) => o.recurring.kind === 'income' && o.status === 'pending' && o.dueDate <= today);
  return { payments, incomes };
}

/** Эквивалент в месяц для подписок: неделя × 52 / 12, год / 12. */
export function monthlyEquivalent(r: Recurring): Minor {
  if (r.schedule.type === 'monthly') return r.amount;
  if (r.schedule.type === 'weekly') return mulDivRound(r.amount, 52, 12);
  return mulDivRound(r.amount, 1, 12);
}

/** Следующее наступление после сегодняшнего дня включительно — для списка «Регулярные». */
export function nextDueDate(r: Recurring, today: LocalDate): LocalDate | undefined {
  return occurrenceDates(r, today, addDays(today, 400))[0];
}

