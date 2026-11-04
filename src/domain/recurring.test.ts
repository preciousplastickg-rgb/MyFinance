import { describe, expect, it } from 'vitest';
import { computeBalances } from './balance';
import { dailyLimit, describeSchedule, monthlyEquivalent, nextDueDate, occurrenceDates, occurrences, todayAgenda } from './recurring';
import type { Account, OccurrenceLog, Recurring, Transaction } from './types';

const rec = (id: string, extra: Partial<Recurring>): Recurring => ({
  id, kind: 'expense', name: id, amount: 100_000, currency: 'KGS', accountId: 'mbank', categoryId: 'c',
  schedule: { type: 'monthly', day: 1 }, isMandatory: true, isSubscription: false, startDate: '2026-01-01', active: true, ...extra,
});

describe('describeSchedule', () => {
  it('по-русски', () => {
    expect(describeSchedule({ type: 'monthly', day: 10 })).toBe('10-го числа');
    expect(describeSchedule({ type: 'weekly', weekday: 1 })).toBe('по понедельникам');
    expect(describeSchedule({ type: 'yearly', month: 3, day: 1 })).toBe('1 марта каждый год');
  });
});

describe('occurrenceDates', () => {
  it('платёж на 31-е число в феврале падает на 28-е (приёмка этапа 5)', () => {
    const r = rec('rent', { schedule: { type: 'monthly', day: 31 } });
    expect(occurrenceDates(r, '2027-01-15', '2027-04-15')).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
    expect(occurrenceDates(r, '2028-02-01', '2028-02-29')).toEqual(['2028-02-29']);
    expect(occurrenceDates(r, '2026-04-01', '2026-04-30')).toEqual(['2026-04-30']);
  });
  it('еженедельно, 1 = понедельник', () => {
    expect(occurrenceDates(rec('w', { schedule: { type: 'weekly', weekday: 1 } }), '2026-11-04', '2026-11-20')).toEqual(['2026-11-09', '2026-11-16']);
    expect(occurrenceDates(rec('w', { schedule: { type: 'weekly', weekday: 3 } }), '2026-11-04', '2026-11-11')).toEqual(['2026-11-04', '2026-11-11']);
  });
  it('ежегодно, 29 февраля в невисокосный — 28-е', () => {
    expect(occurrenceDates(rec('y', { schedule: { type: 'yearly', month: 2, day: 29 } }), '2026-01-01', '2028-12-31')).toEqual([
      '2026-02-28', '2027-02-28', '2028-02-29',
    ]);
  });
  it('не раньше startDate', () => {
    expect(occurrenceDates(rec('x', { schedule: { type: 'monthly', day: 5 }, startDate: '2026-11-06' }), '2026-10-01', '2026-12-31')).toEqual(['2026-12-05']);
  });
});

describe('occurrences', () => {
  it('окно [сегодня − 31; сегодня + 62], статусы из журнала, неактивные не участвуют', () => {
    const logs: OccurrenceLog[] = [{ id: 'l', recurringId: 'a', dueDate: '2026-11-01', status: 'done' }];
    const list = occurrences([rec('a', {}), rec('off', { active: false })], logs, '2026-11-04');
    expect(list.map((o) => [o.dueDate, o.status])).toEqual([
      ['2026-11-01', 'done'],
      ['2026-12-01', 'pending'],
      ['2027-01-01', 'pending'],
    ]);
  });
});

describe('лимит на день', () => {
  const account = (id: string, opening: number, extra: Partial<Account> = {}): Account => ({
    id, name: id, type: 'bank', currency: 'KGS', icon: 'Landmark', color: '#2448D6', includeInDaily: true,
    openingBalance: opening, openingDate: '2026-11-01', sortOrder: 0, archived: false, ...extra,
  });
  const expense = (id: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
    id, type: 'expense', date: '2026-11-04', accountId: 'mbank', amount, categoryId: 'cafe', createdAt: 1, updatedAt: 1, ...extra,
  });

  it('контрольный пример SPEC 4.4: лимит 1 850, осталось 1 210', () => {
    // B = 27 600: MBank 20 000 + Наличные 7 600 на начало дня; потрачено сегодня 640 (с MBank).
    // USDT в лимит не входит.
    const accounts = [account('mbank', 2_000_000), account('cash', 760_000), account('usdt', 100_000, { currency: 'USDT', includeInDaily: false })];
    const transactions = [expense('coffee', 24_000), expense('lunch', 40_000)];
    const recurring = [
      rec('salary', { kind: 'income', amount: 6_000_000, schedule: { type: 'monthly', day: 10 }, isMandatory: false }),
      rec('rent', { amount: 1_500_000, schedule: { type: 'monthly', day: 5 } }),
      rec('internet', { amount: 100_000, schedule: { type: 'monthly', day: 7 } }),
      rec('phone', { amount: 50_000, schedule: { type: 'monthly', day: 8 } }),
      rec('gym', { amount: 300_000, schedule: { type: 'monthly', day: 20 } }), // после зарплаты — не входит
      rec('netflix', { amount: 80_000, schedule: { type: 'monthly', day: 6 }, isMandatory: false }), // не обязательный
    ];
    const today = '2026-11-04';
    const logs: OccurrenceLog[] = [
      // прошлые месяцы оплачены
      ...['rent', 'internet', 'phone', 'gym', 'netflix'].map((id) => ({ id, recurringId: id, dueDate: id === 'gym' ? '2026-10-20' : `2026-10-0${{ rent: 5, internet: 7, phone: 8, netflix: 6 }[id]}`, status: 'done' as const })),
      { id: 's', recurringId: 'salary', dueDate: '2026-10-10', status: 'done' },
    ];
    const l = dailyLimit({
      today, accounts, balances: computeBalances(accounts, transactions), transactions, occurrences: occurrences(recurring, logs, today),
    });
    expect(l.income?.recurring.id).toBe('salary');
    expect(l.days).toBe(6);
    expect(l.startOfDay).toBe(2_760_000);
    expect(l.mandatory).toBe(1_650_000);
    expect(l.spentToday).toBe(64_000);
    expect(l.limit).toBe(185_000); // 1 850 сом
    expect(l.left).toBe(121_000); // 1 210 сом
    expect(l.status).toBe('ok');
  });

  it('обязательный платёж со счёта вне лимита не входит в M', () => {
    const accounts = [account('mbank', 2_000_000), account('usdt', 100_000, { currency: 'USDT', includeInDaily: false })];
    const recurring = [
      rec('salary', { kind: 'income', schedule: { type: 'monthly', day: 10 }, isMandatory: false }),
      rec('rent', { amount: 1_500_000, schedule: { type: 'monthly', day: 5 } }),
      rec('vpn', { amount: 500, currency: 'USDT', accountId: 'usdt', schedule: { type: 'monthly', day: 6 } }),
    ];
    const l = dailyLimit({
      today: '2026-11-04', accounts, balances: computeBalances(accounts, []), transactions: [],
      occurrences: occurrences(recurring, [], '2026-11-04'), rateFor: () => 875_000,
    });
    // Аренда за октябрь просрочена и тоже входит; VPN с USDT — нет.
    expect(l.mandatoryItems.map((o) => o.recurring.id)).toEqual(['rent', 'rent']);
    expect(l.mandatory).toBe(3_000_000);
  });

  it('оплата регулярного платежа не считается «потрачено сегодня», но уменьшает B и M', () => {
    const accounts = [account('mbank', 2_760_000)];
    const recurring = [
      rec('salary', { kind: 'income', schedule: { type: 'monthly', day: 10 }, isMandatory: false }),
      rec('rent', { amount: 1_500_000, schedule: { type: 'monthly', day: 5 } }),
    ];
    const paid = expense('rent-paid', 1_500_000, { recurringId: 'rent', dueDate: '2026-11-05' });
    const logs: OccurrenceLog[] = [{ id: 'l', recurringId: 'rent', dueDate: '2026-11-05', status: 'done', transactionId: 'rent-paid' }];
    const before = dailyLimit({ today: '2026-11-04', accounts, balances: computeBalances(accounts, []), transactions: [], occurrences: occurrences(recurring, [], '2026-11-04') });
    const after = dailyLimit({ today: '2026-11-04', accounts, balances: computeBalances(accounts, [paid]), transactions: [paid], occurrences: occurrences(recurring, logs, '2026-11-04') });
    expect(after.spentToday).toBe(0);
    expect(after.limit).toBe(before.limit);
  });

  it('просроченный обязательный платёж входит в M', () => {
    const accounts = [account('mbank', 1_000_000)];
    const recurring = [rec('salary', { kind: 'income', schedule: { type: 'monthly', day: 10 }, isMandatory: false }), rec('rent', { amount: 300_000, schedule: { type: 'monthly', day: 1 } })];
    const l = dailyLimit({ today: '2026-11-04', accounts, balances: computeBalances(accounts, []), transactions: [], occurrences: occurrences(recurring, [{ id: 's', recurringId: 'salary', dueDate: '2026-10-10', status: 'done' }, { id: 'r', recurringId: 'rent', dueDate: '2026-10-01', status: 'done' }], '2026-11-04') });
    expect(l.mandatory).toBe(300_000);
    expect(l.mandatoryItems.map((o) => o.dueDate)).toEqual(['2026-11-01']);
  });

  it('не хватает на обязательные', () => {
    const accounts = [account('mbank', 100_000)];
    const recurring = [rec('salary', { kind: 'income', schedule: { type: 'monthly', day: 10 }, isMandatory: false }), rec('rent', { amount: 1_500_000, schedule: { type: 'monthly', day: 5 } })];
    const paidOctober: OccurrenceLog[] = [{ id: 'r', recurringId: 'rent', dueDate: '2026-10-05', status: 'done' }];
    const l = dailyLimit({ today: '2026-11-04', accounts, balances: computeBalances(accounts, []), transactions: [], occurrences: occurrences(recurring, paidOctober, '2026-11-04') });
    expect(l.status).toBe('shortfall');
    expect(l.mandatory - l.startOfDay).toBe(1_400_000);
  });

  it('перерасход', () => {
    const accounts = [account('mbank', 1_000_000)];
    const tx = [expense('big', 500_000)];
    const recurring = [rec('salary', { kind: 'income', schedule: { type: 'monthly', day: 10 }, isMandatory: false })];
    const l = dailyLimit({ today: '2026-11-04', accounts, balances: computeBalances(accounts, tx), transactions: tx, occurrences: occurrences(recurring, [], '2026-11-04') });
    expect(l.limit).toBe(166_000); // 10 000 / 6 = 1 666 → 1 660
    expect(l.left).toBe(-334_000);
    expect(l.status).toBe('overspent');
  });

  it('без источников дохода — до конца месяца', () => {
    const accounts = [account('mbank', 2_700_000)];
    const l = dailyLimit({ today: '2026-11-04', accounts, balances: computeBalances(accounts, []), transactions: [], occurrences: [] });
    expect(l.income).toBeUndefined();
    expect(l.days).toBe(27);
    expect(l.limit).toBe(100_000);
  });

  it('D не меньше 1, неотмеченная сегодняшняя зарплата не сужает горизонт', () => {
    const accounts = [account('mbank', 3_100_000)];
    const recurring = [rec('salary', { kind: 'income', schedule: { type: 'monthly', day: 4 }, isMandatory: false })];
    const l = dailyLimit({ today: '2026-11-04', accounts, balances: computeBalances(accounts, []), transactions: [], occurrences: occurrences(recurring, [], '2026-11-04') });
    expect(l.income?.dueDate).toBe('2026-12-04');
    expect(l.days).toBe(30);
  });
});

describe('todayAgenda', () => {
  it('платежи до поступления и доходы, которые пора отметить', () => {
    const recurring = [
      rec('salary', { kind: 'income', schedule: { type: 'monthly', day: 3 }, isMandatory: false }),
      rec('rent', { schedule: { type: 'monthly', day: 5 } }),
      rec('gym', { schedule: { type: 'monthly', day: 20 }, isMandatory: false }),
    ];
    const occ = occurrences(recurring, [
      { id: '1', recurringId: 'rent', dueDate: '2026-10-05', status: 'done' },
      { id: '2', recurringId: 'gym', dueDate: '2026-10-20', status: 'skipped' },
      { id: '3', recurringId: 'salary', dueDate: '2026-10-03', status: 'done' },
    ], '2026-11-04');
    const { payments, incomes } = todayAgenda(occ, '2026-11-04', '2026-12-03');
    expect(payments.map((o) => `${o.recurring.id} ${o.dueDate}`)).toEqual(['rent 2026-11-05', 'gym 2026-11-20']);
    expect(incomes.map((o) => o.dueDate)).toEqual(['2026-11-03']);
  });
});

describe('подписки и следующее наступление', () => {
  it('эквивалент в месяц', () => {
    expect(monthlyEquivalent(rec('m', { amount: 20_000 }))).toBe(20_000);
    expect(monthlyEquivalent(rec('w', { amount: 12_000, schedule: { type: 'weekly', weekday: 1 } }))).toBe(52_000);
    expect(monthlyEquivalent(rec('y', { amount: 120_000, schedule: { type: 'yearly', month: 1, day: 1 } }))).toBe(10_000);
  });
  it('nextDueDate', () => {
    expect(nextDueDate(rec('r', { schedule: { type: 'monthly', day: 5 } }), '2026-11-04')).toBe('2026-11-05');
    expect(nextDueDate(rec('r', { schedule: { type: 'monthly', day: 4 } }), '2026-11-04')).toBe('2026-11-04');
  });
});
