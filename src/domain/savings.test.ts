import { describe, expect, it } from 'vitest';
import { defaultAccount } from './quickEntry';
import { activeJars, everydayAccounts, jarState, monthsUntil, savingsTotals } from './savings';
import type { Account, Transaction } from './types';

const acc = (id: string, extra: Partial<Account> = {}): Account => ({
  id, name: id, type: 'bank', currency: 'KGS', icon: 'Landmark', color: '#2448D6', includeInDaily: true,
  openingBalance: 0, openingDate: '2026-11-01', sortOrder: 0, archived: false, ...extra,
});
const jar = (id: string, extra: Partial<Account> = {}) => acc(id, { type: 'savings', includeInDaily: false, purpose: 'fund', ...extra });

describe('копилка', () => {
  it('копилки отдельно от обычных счетов', () => {
    const all = [acc('mbank'), jar('edu'), jar('old', { archived: true })];
    expect(everydayAccounts(all).map((a) => a.id)).toEqual(['mbank']);
    expect(activeJars(all).map((a) => a.id)).toEqual(['edu']);
  });

  it('прогресс к цели и сколько откладывать в месяц', () => {
    const edu = jar('edu', { goal: 10_000_000, goalDate: '2027-03-15' });
    expect(jarState(edu, 2_500_000, '2026-11-06')).toMatchObject({ percent: 25, left: 7_500_000, reached: false, perMonth: 1_875_000 });
    expect(jarState(edu, 12_000_000, '2026-11-06')).toMatchObject({ percent: 100, left: 0, reached: true });
    expect(jarState(edu, 12_000_000, '2026-11-06').perMonth).toBeUndefined();
    expect(jarState(jar('free'), 500, '2026-11-06')).toEqual({ jar: jar('free'), balance: 500, reached: false });
    expect(monthsUntil('2026-11-06', '2026-11-30')).toBe(1);
    expect(monthsUntil('2026-11-06', '2027-03-15')).toBe(4);
  });

  it('итог по валютам и ≈ в сомах; без курса — в missing', () => {
    const jars = [jar('kgs'), jar('usd', { currency: 'USD' }), jar('eur', { currency: 'EUR' })];
    const balances = new Map([['kgs', 1_000_000], ['usd', 10_000], ['eur', 5_000]]);
    const t = savingsTotals(jars, balances, (c) => (c === 'USD' ? 875_000 : undefined));
    expect(t.kgs).toBe(1_000_000 + 875_000);
    expect(t.approx).toBe(true);
    expect(t.missing).toEqual(['EUR']);
    expect(t.byCurrency.get('USD')).toBe(10_000);
  });

  it('копилка не подставляется счётом по умолчанию для траты и перевода «откуда»', () => {
    const accounts = [jar('edu'), acc('mbank')];
    const intoJar: Transaction = { id: 't', type: 'expense', date: '2026-11-05', accountId: 'edu', amount: 100, categoryId: 'c', createdAt: 9, updatedAt: 9 };
    expect(defaultAccount('expense', [intoJar], accounts)?.id).toBe('mbank');
    expect(defaultAccount('transfer', [], accounts)?.id).toBe('mbank');
  });
});
