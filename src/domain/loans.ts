import { mulDivRound } from './arith';
import { isBase } from './currency';
import { clampedDate, parseLocalDate } from './date';
import { toKgs } from './rate';
import type { Currency, Loan, LoanPayment, LocalDate, Minor, OccurrenceLog, Rate, Recurring } from './types';

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

/** Как пересчитать остальные платежи, когда сумму одного поменяли: срок прежний, платежи другие — или наоборот. */
export type RecalcMode = 'payment' | 'term';

/** Больше платежей календарь не набирает: тот же предел, что у срока в окне кредита. */
const MAX_PAYMENTS = 360;

/** Следующий месяц после даты — в число первого платежа (29–31 в коротком месяце — последний день). */
function nextPaymentDate(after: LocalDate, firstDate: LocalDate): LocalDate {
  const { year, month } = parseLocalDate(after);
  return clampedDate(year + Math.floor(month / 12), (month % 12) + 1, parseLocalDate(firstDate).day);
}

/**
 * Перерасчёт календаря после того, как сумму платежа `edit.index` поменяли (по просьбе пользователя, 4.11).
 * `payments` — календарь до правки, по порядку; `paid` — номера оплаченных платежей: их суммы не меняются, и
 * пересчитываются только платежи после правленого и после последнего оплаченного.
 *
 * - `payment` — срок прежний: остаток делится на оставшиеся месяцы. Кредит со ставкой — как в банке: аннуитет на остаток
 *   долга после правленого платежа (проценты на остаток, последний платёж закрывает его до тыйына). Без ставки — остаток
 *   по календарю поровну, остаток от деления — в последний.
 * - `term` — остальные платежи как в графике, меняется срок: заплатили больше — последний платёж меньше и лишние
 *   уходят, меньше — в конце добавляются месяцы с обычной суммой.
 *
 * Долг закрыт правленым платежом — дальше платежей нет.
 */
export function recalcPayments(
  loan: Pick<Loan, 'kind' | 'principal' | 'rate' | 'firstDate'>,
  payments: readonly LoanPayment[],
  edit: { index: number; amount: Minor },
  paid: ReadonlySet<number>,
  mode: RecalcMode,
): LoanPayment[] {
  const rows = payments.map((p, i) => (i === edit.index ? { ...p, amount: edit.amount } : { ...p }));
  const start = Math.max(edit.index, ...[...paid].filter((i) => i < rows.length)) + 1;
  const head = rows.slice(0, start);
  const tail = rows.slice(start);
  // Обычный платёж для новых месяцев в конце — ближайший по графику после правленого.
  const regular = tail[0]?.amount ?? payments[edit.index]!.amount;
  const out: LoanPayment[] = [];
  let date = head[head.length - 1]!.date;
  const more = (amount: Minor) => {
    date = nextPaymentDate(date, loan.firstDate);
    out.push({ date, amount });
  };
  const done = () => [...head, ...out.filter((p) => p.amount > 0)];

  const rate = loan.rate ?? 0;
  if (loan.kind === 'credit' && rate > 0) {
    // Остаток долга после правленого: проценты каждый месяц на остаток, как в buildSchedule.
    const interest = (b: Minor) => mulDivRound(b, rate, 120_000);
    let balance = head.reduce((b, p) => b + interest(b) - p.amount, loan.principal);
    if (balance <= 0) return head;
    if (mode === 'payment') {
      if (!tail.length) {
        more(balance + interest(balance));
        return done();
      }
      const A = annuityPayment(balance, rate, tail.length);
      tail.forEach((p, k) => {
        const i = interest(balance);
        if (k === tail.length - 1) out.push({ date: p.date, amount: balance + i });
        else {
          out.push({ date: p.date, amount: A });
          balance -= A - i;
        }
      });
      return done();
    }
    for (const p of tail) {
      const due = balance + interest(balance);
      if (due <= p.amount) {
        out.push({ date: p.date, amount: due });
        return done();
      }
      out.push(p);
      date = p.date;
      balance = due - p.amount;
    }
    for (;;) {
      const i = interest(balance);
      // Обычный платёж не покрывает проценты — долг им не закрыть: остаток одним платежом.
      if (balance + i <= regular || regular <= i || head.length + out.length >= MAX_PAYMENTS - 1) {
        more(balance + i);
        return done();
      }
      more(regular);
      balance += i - regular;
    }
  }

  // Рассрочка и кредит без ставки: долг — сумма календаря до правки.
  let left = payments.reduce((s, p) => s + p.amount, 0) - head.reduce((s, p) => s + p.amount, 0);
  if (left <= 0) return head;
  if (mode === 'payment') {
    if (!tail.length) {
      more(left);
      return done();
    }
    // Тыйынов меньше, чем месяцев, — весь остаток в ближайший платёж.
    const n = Math.floor(left / tail.length) > 0 ? tail.length : 1;
    const base = Math.floor(left / n);
    tail.slice(0, n).forEach((p, k) => out.push({ date: p.date, amount: k === n - 1 ? left - base * (n - 1) : base }));
    return done();
  }
  for (const p of tail) {
    if (left <= p.amount) {
      out.push({ date: p.date, amount: left });
      return done();
    }
    out.push(p);
    date = p.date;
    left -= p.amount;
  }
  while (left > 0) {
    const amount = regular > 0 && head.length + out.length < MAX_PAYMENTS - 1 ? Math.min(regular, left) : left;
    more(amount);
    left -= amount;
  }
  return done();
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

export interface LoansOverview {
  /** Активные кредиты и рассрочки, которые ещё не выплачены. */
  count: number;
  /** Есть кредиты, но все выплачены (или отключены). */
  any: boolean;
  /** Осталось выплатить по ним, ≈ в сомах. */
  left: Minor;
  /** В сумме есть валюта по курсу. */
  approx: boolean;
  /** Валюты кредитов без курса — в сумму не вошли. */
  missing: Currency[];
}

/**
 * Кредиты для карточки «Деньги» (по просьбе пользователя, 2026-11-08): сколько активных ещё не выплачено и сколько по
 * ним осталось — по календарю и отметкам «оплачено», валюта по последнему курсу.
 */
export function loansOverview(
  recurring: readonly Recurring[],
  logs: readonly Pick<OccurrenceLog, 'recurringId' | 'dueDate' | 'status'>[],
  rateFor: (currency: Currency) => Rate | undefined,
): LoansOverview {
  const loans = recurring.filter((r) => r.loan && !r.deletedAt);
  let count = 0;
  let left = 0;
  let approx = false;
  const missing = new Set<Currency>();
  for (const r of loans) {
    if (!r.active) continue;
    const rest = loanSummary(r.loan!, logs.filter((l) => l.recurringId === r.id)).left;
    if (rest <= 0) continue;
    count++;
    if (isBase(r.currency)) left += rest;
    else {
      const rate = rateFor(r.currency);
      if (!rate) missing.add(r.currency);
      else {
        left += toKgs(rest, rate);
        approx = true;
      }
    }
  }
  return { count, any: loans.length > 0, left, approx, missing: [...missing] };
}
