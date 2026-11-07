import { mulDivRound } from './arith';
import { clampedDate, parseLocalDate } from './date';
import type { Loan, LoanPayment, LocalDate, Minor, OccurrenceLog, Recurring } from './types';

/**
 * Кредиты и рассрочки (этап 29). Всё в целых: суммы ×100, ставка — % ×100 (24,5 % → 2450). Аннуитет считается точно
 * через BigInt — степень (1 + r)ⁿ в рациональных числах, без float.
 */

/** Сколько знаменатель месячной ставки: годовая ×100 / 12 / 100 → r = ставка / 120 000. */
const MONTH_DEN = 120_000n;

/** Даты платежей: каждый месяц в число первого платежа; 29–31 в коротком месяце — последний день. */
export function loanDates(firstDate: LocalDate, months: number): LocalDate[] {
  const { year, month, day } = parseLocalDate(firstDate);
  return Array.from({ length: months }, (_, i) => {
    const m0 = month - 1 + i;
    return clampedDate(year + Math.floor(m0 / 12), (m0 % 12) + 1, day);
  });
}

/** round(a / b) для положительных BigInt, половина — вверх. */
const roundDiv = (a: bigint, b: bigint) => (a * 2n + b) / (b * 2n);

/** Ежемесячный аннуитетный платёж: A = P · r · qⁿ / (qⁿ − 1), r = ставка / 12. Ставка 0 — P / n. */
export function annuityPayment(principal: Minor, rate: number, months: number): Minor {
  if (months <= 0) throw new Error('Срок должен быть больше нуля');
  if (!rate) return mulDivRound(principal, 1, months);
  const P = BigInt(principal);
  const bp = BigInt(rate);
  const qn = (MONTH_DEN + bp) ** BigInt(months);
  const dn = MONTH_DEN ** BigInt(months);
  return Number(roundDiv(P * bp * qn, MONTH_DEN * (qn - dn)));
}

/**
 * График по условиям. Кредит — аннуитет: проценты каждый месяц на остаток долга, последний платёж закрывает остаток
 * до тыйына. Рассрочка — наценка один раз к цене (обычно 0), сумма делится поровну, остаток от деления — в последний платёж.
 */
export function buildSchedule(loan: Pick<Loan, 'kind' | 'principal' | 'rate' | 'termMonths' | 'firstDate'>): LoanPayment[] {
  const n = Math.max(1, Math.floor(loan.termMonths));
  const dates = loanDates(loan.firstDate, n);
  const rate = loan.rate ?? 0;
  if (loan.kind === 'installment' || !rate) {
    const total = loan.principal + (loan.kind === 'installment' ? mulDivRound(loan.principal, rate, 10_000) : 0);
    const base = Math.floor(total / n);
    return dates.map((date, i) => ({ date, amount: i === n - 1 ? total - base * (n - 1) : base }));
  }
  const A = annuityPayment(loan.principal, rate, n);
  let balance = loan.principal;
  return dates.map((date, i) => {
    const interest = mulDivRound(balance, rate, 120_000);
    if (i === n - 1) return { date, amount: balance + interest };
    balance -= A - interest;
    return { date, amount: A };
  });
}

export interface LoanSummary {
  /** Всего выплатить по календарю. */
  total: Minor;
  /** Переплата: всего − сумма кредита. */
  overpay: Minor;
  /** Переплата в процентах от суммы кредита, ×100. */
  overpayPct: number;
  /** Обычный платёж — первый в календаре. */
  monthly: Minor;
  count: number;
  paidCount: number;
  paid: Minor;
  left: Minor;
  /** Выплачено от всего, ×100. */
  paidPct: number;
  /** Ближайший неоплаченный. */
  next?: LoanPayment;
}

/** Итоги по календарю: оплачено — наступления с отметкой «оплачено» в журнале. */
export function loanSummary(loan: Pick<Loan, 'principal' | 'payments'>, logs: readonly Pick<OccurrenceLog, 'dueDate' | 'status'>[]): LoanSummary {
  const done = new Set(logs.filter((l) => l.status === 'done').map((l) => l.dueDate));
  const payments = [...loan.payments].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const total = payments.reduce((s, p) => s + p.amount, 0);
  const paidList = payments.filter((p) => done.has(p.date));
  const paid = paidList.reduce((s, p) => s + p.amount, 0);
  const overpay = total - loan.principal;
  return {
    total,
    overpay,
    overpayPct: loan.principal > 0 ? mulDivRound(overpay, 10_000, loan.principal) : 0,
    monthly: payments[0]?.amount ?? 0,
    count: payments.length,
    paidCount: paidList.length,
    paid,
    left: total - paid,
    paidPct: total > 0 ? mulDivRound(paid, 10_000, total) : 0,
    ...(payments.find((p) => !done.has(p.date)) ? { next: payments.find((p) => !done.has(p.date))! } : {}),
  };
}

/** «24,5 %» из ×100; целое — без запятой. */
export function formatPercent(pct100: number): string {
  const sign = pct100 < 0 ? '−' : '';
  const abs = Math.abs(pct100);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${sign}${whole}${frac ? `,${String(frac).padStart(2, '0').replace(/0$/, '')}` : ''}%`;
}

/** Номер платежа в календаре: «3 из 12». Не платёж кредита — undefined. */
export function loanPaymentNo(r: Pick<Recurring, 'loan'>, date: LocalDate): { no: number; of: number } | undefined {
  if (!r.loan) return undefined;
  const dates = r.loan.payments.map((p) => p.date).sort();
  const i = dates.indexOf(date);
  return i < 0 ? undefined : { no: i + 1, of: dates.length };
}

/** Поля регулярного платежа по календарю кредита: сумма, начало и конец, день месяца. */
export function loanRecurringFields(loan: Loan): Pick<Recurring, 'amount' | 'startDate' | 'endDate' | 'schedule'> {
  const payments = [...loan.payments].sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = payments[0]!;
  const last = payments[payments.length - 1]!;
  return { amount: first.amount, startDate: first.date, endDate: last.date, schedule: { type: 'monthly', day: parseLocalDate(loan.firstDate).day } };
}
