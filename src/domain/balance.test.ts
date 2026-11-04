import { describe, expect, it } from 'vitest';
import { computeBalances, totalInKgs } from './balance';
import type { Account, Transaction } from './types';

const acc = (id: string, opening: number, currency = 'KGS'): Account => ({
  id, name: id, type: currency === 'KGS' ? 'bank' : 'crypto', currency, icon: 'Landmark', color: '#2448D6',
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

  it('операции раньше даты остатка его не меняют (остаток уже их включает)', () => {
    const accounts = [acc('mbank', 1_000_000), acc('cash', 0)];
    const b = computeBalances(accounts, [
      tx({ type: 'expense', accountId: 'mbank', amount: 25_000, date: '2026-10-31' }),
      tx({ type: 'expense', accountId: 'mbank', amount: 10_000, date: '2026-11-01' }),
      // Перевод до даты остатка: не трогает ни отправителя, ни получателя с той же датой остатка.
      tx({ type: 'transfer', accountId: 'mbank', amount: 5_000, toAccountId: 'cash', toAmount: 5_000, date: '2026-10-30' }),
    ]);
    expect(b.get('mbank')).toBe(990_000);
    expect(b.get('cash')).toBe(0);
  });

  it('перевод считается у каждого счёта по его дате остатка', () => {
    const accounts = [acc('mbank', 1_000_000), { ...acc('cash', 0), openingDate: '2026-10-01' }];
    const b = computeBalances(accounts, [
      tx({ type: 'transfer', accountId: 'mbank', amount: 5_000, toAccountId: 'cash', toAmount: 5_000, date: '2026-10-15' }),
    ]);
    expect(b.get('mbank')).toBe(1_000_000);
    expect(b.get('cash')).toBe(5_000);
  });

  it('отрицательный баланс разрешён', () => {
    const b = computeBalances([acc('cash', 0)], [tx({ type: 'expense', accountId: 'cash', amount: 500 })]);
    expect(b.get('cash')).toBe(-500);
  });
});

describe('totalInKgs', () => {
  const accounts = [acc('mbank', 1_000_000), acc('usdt', 20_000, 'USDT'), acc('usd', 10_000, 'USD'), acc('eur', 5_000, 'EUR')];
  const balances = computeBalances(accounts, []);
  const rates: Record<string, number> = { USDT: 875_000, USD: 873_000, EUR: 951_500 };
  it('«Всего ≈» учитывает USD и EUR по своим курсам (приёмка этапа 11)', () => {
    // 10 000 + 200 × 87,50 + 100 × 87,30 + 50 × 95,15 = 10 000 + 17 500 + 8 730 + 4 757,50 → 4 758
    expect(totalInKgs(accounts, balances, (c) => rates[c])).toEqual({ total: 4_098_800, approx: true, missing: [] });
  });
  it('валюта без курса не входит и попадает в missing', () => {
    expect(totalInKgs(accounts, balances, (c) => (c === 'USDT' ? 875_000 : undefined))).toEqual({
      total: 2_750_000, approx: true, missing: ['USD', 'EUR'],
    });
  });
  it('архивные не считаются', () => {
    expect(totalInKgs([{ ...accounts[0]!, archived: true }], balances, () => undefined).total).toBe(0);
  });
});
