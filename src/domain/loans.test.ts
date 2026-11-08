import { describe, expect, it } from 'vitest';
import { mulDivRound } from './arith';
import { annuityPayment, buildSchedule, formatPercent, loanDates, loanPaymentNo, loanRecurringFields, loanSummary, recalcPayments } from './loans';
import { dailyLimit, occurrences } from './recurring';
import type { Loan, Recurring } from './types';

describe('кредит и рассрочка (этап 29)', () => {
  it('даты платежей — то же число каждый месяц, 31-е в коротком — последний день', () => {
    expect(loanDates('2026-11-30', 4)).toEqual(['2026-11-30', '2026-12-30', '2027-01-30', '2027-02-28']);
  });

  it('аннуитет: 100 000 сом на 12 месяцев под 24 % — 9 456 сом в месяц (как в банковских калькуляторах)', () => {
    // A = 100 000 · 0,02 · 1,02¹² / (1,02¹² − 1) = 9 455,96
    expect(annuityPayment(10_000_000, 2400, 12)).toBe(945_596);
    expect(annuityPayment(10_000_000, 0, 4)).toBe(2_500_000);
  });

  it('график кредита: последний платёж закрывает остаток до тыйына, всего = сумма процентов + долг', () => {
    const s = buildSchedule({ kind: 'credit', principal: 10_000_000, rate: 2400, termMonths: 12, firstDate: '2026-12-05' });
    expect(s).toHaveLength(12);
    expect(s.slice(0, 11).every((p) => p.amount === 945_596)).toBe(true);
    const total = s.reduce((a, p) => a + p.amount, 0);
    // Переплата ≈ 13 471,5 сом; последний платёж отличается от обычного на копейки.
    expect(total - 10_000_000).toBeGreaterThan(1_340_000);
    expect(total - 10_000_000).toBeLessThan(1_350_000);
    expect(Math.abs(s[11]!.amount - 945_596)).toBeLessThan(100);
    expect(s.every((p) => Number.isSafeInteger(p.amount))).toBe(true);
  });

  it('рассрочка: наценка один раз, поровну, остаток от деления — в последний платёж', () => {
    const s = buildSchedule({ kind: 'installment', principal: 3_000_000, rate: 1000, termMonths: 7, firstDate: '2026-11-10' });
    expect(s.reduce((a, p) => a + p.amount, 0)).toBe(3_300_000);
    expect(s.slice(0, 6).every((p) => p.amount === 471_428)).toBe(true);
    expect(s[6]!.amount).toBe(3_300_000 - 471_428 * 6);
    expect(buildSchedule({ kind: 'installment', principal: 1_200_000, termMonths: 3, firstDate: '2026-11-10' }).map((p) => p.amount)).toEqual([400_000, 400_000, 400_000]);
  });

  it('итоги: переплата и её процент, выплачено по отметкам «оплачено», ближайший платёж', () => {
    const loan = { principal: 1_000_000, payments: [
      { date: '2026-11-05', amount: 400_000 }, { date: '2026-12-05', amount: 400_000 }, { date: '2027-01-05', amount: 400_000 },
    ] };
    const s = loanSummary(loan, [{ dueDate: '2026-11-05', status: 'done' }, { dueDate: '2026-12-05', status: 'skipped' }]);
    expect(s).toMatchObject({ total: 1_200_000, overpay: 200_000, overpayPct: 2000, paid: 400_000, paidCount: 1, left: 800_000, paidPct: 3333, count: 3, monthly: 400_000 });
    expect(s.next).toEqual({ date: '2026-12-05', amount: 400_000 });
    expect(formatPercent(2000)).toBe('20%');
    expect(formatPercent(2450)).toBe('24,5%');
    expect(formatPercent(3333)).toBe('33,33%');
  });

  describe('перерасчёт после правки суммы (по просьбе пользователя)', () => {
    // Рассрочка 30 000 на 3 месяца — по 10 000.
    const inst = { kind: 'installment' as const, principal: 3_000_000, rate: 0, firstDate: '2026-11-10' };
    const three = buildSchedule({ ...inst, termMonths: 3 });
    const sums = (p: readonly { amount: number }[]) => p.map((x) => x.amount);
    const none = new Set<number>();

    it('рассрочка: заплатил 15 000 вместо 10 000 — «разделить остаток» по 7 500, «как в графике» — последний 5 000', () => {
      expect(sums(recalcPayments(inst, three, { index: 0, amount: 1_500_000 }, none, 'payment'))).toEqual([1_500_000, 750_000, 750_000]);
      expect(sums(recalcPayments(inst, three, { index: 0, amount: 1_500_000 }, none, 'term'))).toEqual([1_500_000, 1_000_000, 500_000]);
      // 20 000 сразу — по графику хватает ещё одного платежа, третий уходит.
      const short = recalcPayments(inst, three, { index: 0, amount: 2_000_000 }, none, 'term');
      expect(short).toEqual([{ date: '2026-11-10', amount: 2_000_000 }, { date: '2026-12-10', amount: 1_000_000 }]);
      // Весь долг одним платежом — дальше платежей нет.
      expect(sums(recalcPayments(inst, three, { index: 0, amount: 3_000_000 }, none, 'payment'))).toEqual([3_000_000]);
    });

    it('рассрочка: заплатил меньше — «разделить» поднимает остальные, «как в графике» добавляет месяц в конце', () => {
      expect(sums(recalcPayments(inst, three, { index: 0, amount: 500_000 }, none, 'payment'))).toEqual([500_000, 1_250_000, 1_250_000]);
      expect(recalcPayments(inst, three, { index: 0, amount: 500_000 }, none, 'term')).toEqual([
        { date: '2026-11-10', amount: 500_000 },
        { date: '2026-12-10', amount: 1_000_000 },
        { date: '2027-01-10', amount: 1_000_000 },
        { date: '2027-02-10', amount: 500_000 },
      ]);
      // Правка последнего платежа: остаток — новым месяцем.
      expect(recalcPayments(inst, three, { index: 2, amount: 400_000 }, none, 'payment').at(-1)).toEqual({ date: '2027-02-10', amount: 600_000 });
    });

    it('оплаченные платежи не меняются: пересчитываются только неоплаченные после правленого', () => {
      const four = buildSchedule({ ...inst, principal: 4_000_000, termMonths: 4 });
      // Оплачены 1-й и 2-й; во 2-м на самом деле было 15 000.
      expect(sums(recalcPayments(inst, four, { index: 1, amount: 1_500_000 }, new Set([0, 1]), 'payment'))).toEqual([1_000_000, 1_500_000, 750_000, 750_000]);
      // Правят 1-й, а оплачены 1-й и 2-й — 2-й остаётся как был.
      expect(sums(recalcPayments(inst, four, { index: 0, amount: 1_400_000 }, new Set([0, 1]), 'term'))).toEqual([1_400_000, 1_000_000, 1_000_000, 600_000]);
      // Сумма календаря рассрочки не меняется ни в одном режиме.
      for (const mode of ['payment', 'term'] as const) {
        const total = recalcPayments(inst, four, { index: 2, amount: 300_000 }, new Set([0]), mode).reduce((s, p) => s + p.amount, 0);
        expect(total).toBe(4_000_000);
      }
    });

    it('кредит 100 000 на 12 мес. под 24 %: 20 000 первым платежом — аннуитет на остаток 82 000 или срок на месяц короче', () => {
      const credit = { kind: 'credit' as const, principal: 10_000_000, rate: 2400, firstDate: '2026-12-05' };
      const s = buildSchedule({ ...credit, termMonths: 12 });
      // Остаток долга после последнего платежа: проценты 2 % в месяц на остаток.
      const balance = (p: readonly { amount: number }[]) => p.reduce((b, x) => b + mulDivRound(b, 2400, 120_000) - x.amount, 10_000_000);
      expect(balance(s)).toBe(0);

      // Срок прежний: 100 000 + 2 000 процентов − 20 000 = 82 000 на 11 месяцев, A = 82 000 · 0,02 · 1,02¹¹ / (1,02¹¹ − 1) = 8 378,59.
      const pay = recalcPayments(credit, s, { index: 0, amount: 2_000_000 }, new Set(), 'payment');
      expect(pay).toHaveLength(12);
      expect(pay.slice(1, 11).every((p) => p.amount === 837_859)).toBe(true);
      expect(pay.map((p) => p.date)).toEqual(s.map((p) => p.date));
      expect(balance(pay)).toBe(0);

      // Платежи прежние 9 455,96: долг закрывается на 11-м платеже, последний ≈ 5 873,38.
      const term = recalcPayments(credit, s, { index: 0, amount: 2_000_000 }, new Set(), 'term');
      expect(term).toHaveLength(11);
      expect(term.slice(1, 10).every((p) => p.amount === 945_596)).toBe(true);
      expect(Math.abs(term[10]!.amount - 587_338)).toBeLessThan(50);
      expect(balance(term)).toBe(0);
      // Досрочный платёж экономит проценты: всего выплатить меньше, чем по исходному графику.
      const total = (p: readonly { amount: number }[]) => p.reduce((a, x) => a + x.amount, 0);
      expect(total(pay)).toBeLessThan(total(s));
      expect(total(term)).toBeLessThan(total(pay));

      // Заплатил меньше обычного — срок длиннее: новый месяц 5 декабря 2027-го.
      const longer = recalcPayments(credit, s, { index: 0, amount: 500_000 }, new Set(), 'term');
      expect(longer).toHaveLength(13);
      expect(longer[12]!.date).toBe('2027-12-05');
      expect(balance(longer)).toBe(0);
    });
  });

  it('наступления кредита — по календарю, со своей суммой; лимит резервирует платёж кредита, а не первую сумму', () => {
    const loan: Loan = {
      kind: 'credit', principal: 2_000_000, rate: 0, termMonths: 3, firstDate: '2026-11-06',
      payments: [{ date: '2026-11-06', amount: 500_000 }, { date: '2026-12-06', amount: 700_000 }, { date: '2027-01-06', amount: 800_000 }],
    };
    const r: Recurring = {
      id: 'loan', kind: 'expense', name: 'Кредит на ремонт', currency: 'KGS', accountId: 'mbank', categoryId: 'home', isMandatory: true,
      isSubscription: false, active: true, ...loanRecurringFields(loan), loan,
    };
    expect(r).toMatchObject({ amount: 500_000, startDate: '2026-11-06', endDate: '2027-01-06', schedule: { type: 'monthly', day: 6 } });
    const occ = occurrences([r], [], '2026-11-30');
    expect(occ.map((o) => [o.dueDate, o.amount])).toEqual([['2026-11-06', 500_000], ['2026-12-06', 700_000], ['2027-01-06', 800_000]]);
    expect(loanPaymentNo(r, '2026-12-06')).toEqual({ no: 2, of: 3 });
    expect(loanPaymentNo({}, '2026-12-06')).toBeUndefined();
    const account = { id: 'mbank', name: 'MBank', type: 'bank' as const, currency: 'KGS', icon: 'Landmark', color: 'blue', includeInDaily: true, openingBalance: 5_000_000, openingDate: '2026-11-01', sortOrder: 0, archived: false };
    const limit = dailyLimit({ today: '2026-12-01', accounts: [account], balances: new Map([['mbank', 5_000_000]]), transactions: [], occurrences: occurrences([r], [{ id: 'l', recurringId: 'loan', dueDate: '2026-11-06', status: 'done' }], '2026-12-01') });
    // До конца месяца: 6 декабря — 7 000 сом из календаря.
    expect(limit.mandatory).toBe(700_000);
  });
});
