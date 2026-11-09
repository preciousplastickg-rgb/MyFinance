import { describe, expect, it } from 'vitest';
import { computeBalances } from './balance';
import { currencyTotals, moneyOverview } from './overview';
import { dailyLimit, occurrences, upcomingAgenda } from './recurring';
import type { Account, Debt, Recurring, Transaction } from './types';

// Приёмка этапа 24 (SPEC 4.10): контрольный пример лимита (4 ноября, зарплата 10-го) плюс USDT, копилка, подписка и долги.
const TODAY = '2026-11-04';
const RATE_USDT = 875_000; // 87,50

const account = (id: string, opening: number, extra: Partial<Account> = {}): Account => ({
  id, name: id, type: 'bank', currency: 'KGS', icon: 'Landmark', color: 'blue', includeInDaily: true,
  openingBalance: opening, openingDate: '2026-10-01', sortOrder: 0, archived: false, ...extra,
});
const rec = (id: string, extra: Partial<Recurring>): Recurring => ({
  id, kind: 'expense', name: id, amount: 100_000, currency: 'KGS', accountId: 'mbank', categoryId: 'c',
  schedule: { type: 'monthly', day: 1 }, isMandatory: true, isSubscription: false, startDate: '2026-11-01', active: true, ...extra,
});
let n = 0;
const tx = (extra: Partial<Transaction>): Transaction => ({
  id: `t${n++}`, type: 'expense', date: TODAY, accountId: 'mbank', amount: 0, categoryId: 'c', createdAt: n, updatedAt: n, ...extra,
});

const accounts = [
  account('mbank', 2_000_000),
  account('cash', 760_000, { type: 'cash' }),
  account('usdt', 30_000, { type: 'crypto', currency: 'USDT', includeInDaily: false }),
  account('jar', 1_000_000, { type: 'savings' }),
  account('old', 5_000_000, { archived: true }),
];
const recurring = [
  rec('salary', { kind: 'income', amount: 6_000_000, schedule: { type: 'monthly', day: 10 }, isMandatory: false }),
  rec('rent', { amount: 1_500_000, schedule: { type: 'monthly', day: 5 } }),
  rec('internet', { amount: 100_000, schedule: { type: 'monthly', day: 7 } }),
  rec('phone', { amount: 600, currency: 'USDT', schedule: { type: 'monthly', day: 8 }, accountId: 'usdt' }), // 6 USDT = 525 сом
  rec('netflix', { amount: 20_000, schedule: { type: 'monthly', day: 20 }, isMandatory: false, isSubscription: true }),
  rec('gym', { amount: 300_000, schedule: { type: 'monthly', day: 3 }, startDate: '2026-12-01' }), // с декабря: 3-е попадает в 30 дней, аренда 5-го — нет
];
const debts: Debt[] = [
  { id: 'd1', direction: 'iOwe', person: 'Азамат', currency: 'KGS', opening: 300_000, date: '2026-10-01', createdAt: 1 },
  { id: 'd2', direction: 'owedToMe', person: 'Айбек', currency: 'KGS', opening: 500_000, date: '2026-10-01', createdAt: 2 },
  { id: 'd3', direction: 'iOwe', person: 'Закрыт', currency: 'KGS', opening: 100_000, date: '2026-10-01', createdAt: 3, closedAt: 5 },
];
const transactions = [
  tx({ amount: 24_000 }),
  tx({ amount: 40_000 }),
  tx({ amount: 236_000, date: '2026-10-20' }),
  tx({ amount: 999_000, date: '2026-10-05' }), // раньше 30 дней — в среднее не входит
  tx({ amount: 150_000, recurringId: 'rent', date: '2026-10-05' }), // регулярный — в среднее не входит
  tx({ amount: 1_000, accountId: 'jar', date: '2026-11-01' }), // с копилки — не повседневный
];
const rateFor = (c: string) => (c === 'USDT' ? RATE_USDT : undefined);

function build(over: Partial<Parameters<typeof moneyOverview>[0]> = {}) {
  const occ = occurrences(recurring, [], TODAY);
  const balances = computeBalances(accounts, transactions);
  const limit = dailyLimit({ today: TODAY, accounts, balances, transactions, occurrences: occ, rateFor });
  return moneyOverview({ today: TODAY, accounts, balances, transactions, occurrences: occ, debts, limit, rateFor, ...over });
}

describe('moneyOverview', () => {
  it('остаток: сомовые + USDT по курсу + копилка, архивные не считаются', () => {
    const o = build();
    expect(o.kgs).toBe(2_000_000 + 760_000 - 64_000 - 236_000 - 999_000 - 150_000);
    expect(o.foreign).toBe(2_625_000);
    expect(o.savings).toBe(999_000);
    expect(o.everyday).toBe(o.kgs + o.foreign);
    expect(o.total).toBe(o.everyday + o.savings);
    expect(o.approx).toBe(true);
    expect(o.missing).toEqual([]);
  });

  it('обязательства: до зарплаты — все платежи со всех счетов, дальше — до 4 декабря, плюс мои долги', () => {
    const o = build();
    expect(o.dueNowItems.map((x) => x.recurring.id)).toEqual(['rent', 'internet', 'phone']);
    expect(o.dueNow).toBe(1_500_000 + 100_000 + 52_500);
    expect(o.dueLaterItems.map((x) => x.recurring.id)).toEqual(['netflix', 'gym']);
    expect(o.dueLater).toBe(20_000 + 300_000);
    expect(o.laterUntil).toBe('2026-12-04');
    expect(o.iOwe).toBe(300_000);
    expect(o.owedToMe).toBe(500_000);
    // Платежи дальше (после зарплаты) в «можно потратить» не входят — по просьбе пользователя, 2026-11-08.
    expect(o.obligations).toBe(1_652_500 + 300_000);
    expect(o.free).toBe(o.everyday - 1_652_500 - 300_000);
  });

  it('долги «Только запомнить» в «Я должен», «Мне должны» и «Можно потратить» не входят (по просьбе пользователя, 2026-11-09)', () => {
    const plain = build();
    const memo: Debt[] = [
      { id: 'm1', direction: 'iOwe', person: 'Налог', currency: 'KGS', opening: 1_200_000, date: '2026-10-01', createdAt: 9, memo: true },
      { id: 'm2', direction: 'owedToMe', person: 'Айбек', currency: 'KGS', opening: 50_000, date: '2026-10-01', createdAt: 9, memo: true },
    ];
    const o = build({ debts: [...debts, ...memo] });
    expect([o.iOwe, o.owedToMe, o.obligations, o.free]).toEqual([plain.iOwe, plain.owedToMe, plain.obligations, plain.free]);
  });

  it('средний дневной расход за 30 дней без регулярных и копилок; хватит на N дней', () => {
    const o = build();
    expect(o.avgDaily).toBe(Math.floor((64_000 + 236_000) / 30)); // 100 сом в день
    expect(o.runwayDays).toBe(Math.floor(o.free / o.avgDaily));
  });

  it('без трат за 30 дней или без свободных денег — срока нет', () => {
    expect(build({ transactions: [] }).runwayDays).toBeUndefined();
    const broke = build({ balances: new Map([['mbank', 100_000]]) });
    expect(broke.free).toBeLessThan(0);
    expect(broke.runwayDays).toBeUndefined();
  });

  it('валюта без курса в итог не входит и названа в missing', () => {
    const o = build({ rateFor: () => undefined });
    expect(o.foreign).toBe(0);
    expect(o.missing).toEqual(['USDT']);
    expect(o.dueNow).toBe(1_600_000); // платёж с USDT без курса не считается
  });
});

describe('карточка «Остаток» по валютам и ближайшие платежи (этап 29)', () => {
  it('сумма по каждой валюте — все активные счета с копилками, ноль не показывается, сом первым', () => {
    const balances = computeBalances([...accounts, account('usd0', 0, { currency: 'USD' })], []);
    const list = currencyTotals([...accounts, account('usd0', 0, { currency: 'USD' })], balances, (c) => (c === 'USDT' ? RATE_USDT : undefined));
    expect(list).toEqual([
      { currency: 'KGS', amount: 2_000_000 + 760_000 + 1_000_000 },
      { currency: 'USDT', amount: 30_000, kgs: 2_625_000 },
    ]);
    expect(currencyTotals(accounts, balances, () => undefined)[1]).toEqual({ currency: 'USDT', amount: 30_000 });
  });
  it('платежи на «Сегодня» — просроченные и в ближайшие 3 дня; доходы — когда пора отметить', () => {
    const occ = occurrences(recurring, [], TODAY);
    const a = upcomingAgenda(occ, TODAY);
    // 4 ноября: аренда 5-го и интернет 7-го — да (до 7-го включительно), телефон 8-го — ещё нет; октябрьские неоплаченные — просрочены.
    expect(a.payments.filter((o) => o.dueDate >= TODAY).map((o) => o.recurring.id)).toEqual(['rent', 'internet']);
    expect(a.payments.every((o) => o.dueDate <= '2026-11-07')).toBe(true);
    expect(a.incomes.every((o) => o.dueDate <= TODAY)).toBe(true);
    expect(upcomingAgenda(occ, TODAY, 0).payments.filter((o) => o.dueDate >= TODAY)).toEqual([]);
  });
});
