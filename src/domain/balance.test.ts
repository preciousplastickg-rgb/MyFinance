import { describe, expect, it } from 'vitest';
import { computeBalances, totalInKgs } from './balance';
import type { Account, Transaction } from './types';

const acc = (id: string, opening: number, currency: 'KGS' | 'USDT' = 'KGS'): Account => ({
  id, name: id, type: currency === 'USDT' ? 'crypto' : 'bank', currency, icon: 'Landmark', color: '#2448D6',
  includeInDaily: currency === 'KGS', openingBalance: opening, openingDate: '2026-11-01', sortOrder: 0, archived: false,
});

let n = 0;
const tx = (t: Partial<Transaction> & Pick<Transaction, 'type' | 'accountId' | 'amount'>): Transaction => ({
  id: `t${n++}`, date: '2026-11-02', createdAt: n, updatedAt: n, ...t,
});

describe('computeBalances', () => {
  it('открытие + доходы − расходы − исходящие + входящие', () => {
    const accounts = [acc('mbank', 1_000_000), acc('cash', 50_000), acc('usdt', 30_000, 'USDT')];
    const txs = [
      tx({ type: 'income', accountId: 'mbank', amount: 5_000_000 }),
      tx({ type: 'expense', accountId: 'mbank', amount: 25_000 }),
      tx({ type: 'transfer', accountId: 'mbank', amount: 100_000, toAccountId: 'cash', toAmount: 100_000 }),
      tx({ type: 'transfer', accountId: 'usdt', amount: 20_000, toAccountId: 'mbank', toAmount: 1_750_000, rate: 875_000 }),
    ];
    const b = computeBalances(accounts, txs);
    expect(b.get('mbank')).toBe(1_000_000 + 5_000_000 - 25_000 - 100_000 + 1_750_000);
    expect(b.get('cash')).toBe(150_000);
    expect(b.get('usdt')).toBe(10_000);
  });

  it('отрицательный баланс разрешён', () => {
    const b = computeBalances([acc('cash', 0)], [tx({ type: 'expense', accountId: 'cash', amount: 500 })]);
    expect(b.get('cash')).toBe(-500);
  });
});

describe('totalInKgs', () => {
  const accounts = [acc('mbank', 1_000_000), acc('usdt', 20_000, 'USDT')];
  const balances = computeBalances(accounts, []);
  it('USDT по курсу, с «≈»', () => {
    expect(totalInKgs(accounts, balances, 875_000)).toEqual({ total: 2_750_000, approx: true, missingRate: false });
  });
  it('нет курса — USDT не входит', () => {
    expect(totalInKgs(accounts, balances, undefined)).toEqual({ total: 1_000_000, approx: false, missingRate: true });
  });
  it('архивные не считаются', () => {
    expect(totalInKgs([{ ...accounts[0]!, archived: true }], balances, undefined).total).toBe(0);
  });
});
