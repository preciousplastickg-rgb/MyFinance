import { describe, expect, it } from 'vitest';
import { groupByDay, matchesQuery, monthTotals } from './history';
import { rateBook } from './rate';
import type { Account, Category, Transaction } from './types';

const acc = (id: string, currency = 'KGS'): Account => ({
  id, name: id === 'mbank' ? 'MBank' : id, type: 'bank', currency, icon: 'Landmark', color: '#2448D6',
  includeInDaily: true, openingBalance: 0, openingDate: '2026-01-01', sortOrder: 0, archived: false,
});
const accounts = new Map([acc('mbank'), acc('cash'), acc('usdt', 'USDT')].map((a) => [a.id, a]));
const categories = new Map<string, Category>([
  ['cafe', { id: 'cafe', name: 'Кафе', kind: 'expense', icon: 'Coffee', color: '#B45309', isFixed: false, sortOrder: 0, archived: false }],
]);
let n = 0;
const tx = (t: Partial<Transaction>): Transaction => ({
  id: `t${n++}`, type: 'expense', date: '2026-11-02', accountId: 'mbank', amount: 25_000, createdAt: n, updatedAt: n, ...t,
});

describe('groupByDay', () => {
  it('итог дня без переводов, дни по убыванию', () => {
    const txs = [
      tx({ date: '2026-11-01', amount: 10_000 }),
      tx({ date: '2026-11-02', amount: 25_000 }),
      tx({ date: '2026-11-02', type: 'income', amount: 100_000 }),
      tx({ date: '2026-11-02', type: 'transfer', amount: 50_000, toAccountId: 'cash', toAmount: 50_000 }),
    ];
    const groups = groupByDay(txs, accounts, new Map());
    expect(groups.map((g) => [g.date, g.total, g.items.length])).toEqual([
      ['2026-11-02', 75_000, 3],
      ['2026-11-01', -10_000, 1],
    ]);
  });
  it('USDT в итоге дня — по курсу и с «≈»', () => {
    const rates = rateBook([tx({ type: 'transfer', accountId: 'usdt', amount: 20_000, toAccountId: 'mbank', toAmount: 1_750_000, rate: 875_000 })], accounts);
    const [g] = groupByDay([tx({ accountId: 'usdt', amount: 1_000 })], accounts, rates);
    expect(g).toMatchObject({ total: -87_500, approx: true });
  });
});

describe('monthTotals', () => {
  it('переводы не меняют доходы и расходы, каждая валюта отдельной строкой', () => {
    const rates = rateBook([tx({ type: 'transfer', accountId: 'usdt', amount: 20_000, toAccountId: 'mbank', toAmount: 1_750_000, rate: 875_000 })], accounts);
    const txs = [
      tx({ amount: 25_000 }),
      tx({ type: 'income', amount: 5_000_000 }),
      tx({ type: 'income', accountId: 'usdt', amount: 50_000 }),
      tx({ type: 'transfer', accountId: 'usdt', amount: 20_000, toAccountId: 'mbank', toAmount: 1_750_000, rate: 875_000 }),
    ];
    expect(monthTotals(txs, accounts, rates)).toEqual({
      income: 5_000_000, expense: 25_000,
      foreign: [{ currency: 'USDT', income: 50_000, expense: 0, incomeKgs: 4_375_000, expenseKgs: 0 }],
    });
  });
});

describe('matchesQuery', () => {
  const t = tx({ categoryId: 'cafe', note: 'Обед с Айбеком', amount: 125_000 });
  const m = (q: string, x = t) => matchesQuery(x, q, categories, accounts);
  it('по категории, комментарию и сумме', () => {
    expect(m('каф')).toBe(true);
    expect(m('айбек')).toBe(true);
    expect(m('1250')).toBe(true);
    expect(m('1 250')).toBe(true);
    expect(m('125')).toBe(true);
    expect(m('999')).toBe(false);
    expect(m('такси')).toBe(false);
    expect(m('')).toBe(true);
  });
  it('перевод находится по счетам', () => {
    expect(m('mbank', tx({ type: 'transfer', accountId: 'usdt', toAccountId: 'mbank' }))).toBe(true);
  });
});
