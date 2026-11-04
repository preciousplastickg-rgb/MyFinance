import { describe, expect, it } from 'vitest';
import { computeBalances } from './balance';
import { monthTotals } from './history';
import { formatRate } from './money';
import { rateFromAmounts, rateHistory, rateOn, rateUpdateAfter, transferRate, usdtToKgs } from './rate';
import type { Account, Settings, Transaction } from './types';

const transfer = (date: string, rate: number, at = 0): Transaction => ({
  id: date + rate, type: 'transfer', date, accountId: 'usdt', amount: 10_000, toAccountId: 'mbank',
  toAmount: 10_000, rate, createdAt: at, updatedAt: at,
});

describe('курс USDT', () => {
  it('200 USDT → 17 500 сом = 87,50', () => {
    expect(rateFromAmounts(1_750_000, 20_000)).toBe(875_000);
  });
  it('перевод USDT в сомы', () => {
    expect(usdtToKgs(20_000, 875_000)).toBe(1_750_000);
    expect(usdtToKgs(1, 875_000)).toBe(88);
  });
  it('курс на дату: последний до, иначе первый после', () => {
    const h = rateHistory([transfer('2026-10-20', 880_000), transfer('2026-10-05', 870_000), transfer('2026-11-02', 875_000)]);
    expect(rateOn(h, '2026-10-21')).toBe(880_000);
    expect(rateOn(h, '2026-10-05')).toBe(870_000);
    expect(rateOn(h, '2026-09-01')).toBe(870_000);
    expect(rateOn(h, '2026-12-01')).toBe(875_000);
    expect(rateOn([], '2026-12-01')).toBeUndefined();
  });
  it('ручной курс из настроек участвует в истории', () => {
    const h = rateHistory([transfer('2026-10-05', 870_000)], {
      key: 'main', smallExpenseThreshold: 30_000, theme: 'system', lastUsdtRate: 900_000, lastUsdtRateDate: '2026-11-01',
    });
    expect(rateOn(h, '2026-11-03')).toBe(900_000);
  });
});

describe('перевод 200 USDT → 17 500 сом (приёмка этапа 4)', () => {
  const accounts: Account[] = [
    { id: 'usdt', name: 'USDT', type: 'crypto', currency: 'USDT', icon: 'Coins', color: '#0E7490', includeInDaily: false, openingBalance: 50_000, openingDate: '2026-11-01', sortOrder: 0, archived: false },
    { id: 'mbank', name: 'MBank', type: 'bank', currency: 'KGS', icon: 'Landmark', color: '#0B7A4B', includeInDaily: true, openingBalance: 1_000_000, openingDate: '2026-11-01', sortOrder: 1, archived: false },
  ];
  const expense: Transaction = { id: 'e', type: 'expense', date: '2026-11-02', accountId: 'mbank', amount: 25_000, categoryId: 'cafe', createdAt: 1, updatedAt: 1 };
  const rate = transferRate({ currency: 'USDT', amount: 20_000 }, { currency: 'KGS', amount: 1_750_000 });
  const transfer: Transaction = {
    id: 't', type: 'transfer', date: '2026-11-02', accountId: 'usdt', amount: 20_000, toAccountId: 'mbank', toAmount: 1_750_000, rate, createdAt: 2, updatedAt: 2,
  };

  it('курс 87,50', () => {
    expect(rate).toBe(875_000);
    expect(formatRate(rate!)).toBe('87,50');
  });
  it('балансы обоих счетов', () => {
    const b = computeBalances(accounts, [expense, transfer]);
    expect(b.get('usdt')).toBe(50_000 - 20_000);
    expect(b.get('mbank')).toBe(1_000_000 - 25_000 + 1_750_000);
  });
  it('доходы и расходы месяца не изменились', () => {
    const byId = new Map(accounts.map((a) => [a.id, a]));
    expect(monthTotals([expense, transfer], byId, [])).toEqual(monthTotals([expense], byId, []));
  });
  it('обратный перевод сом → USDT даёт тот же «сом за 1 USDT»', () => {
    expect(transferRate({ currency: 'KGS', amount: 1_750_000 }, { currency: 'USDT', amount: 20_000 })).toBe(875_000);
  });
  it('одна валюта — без курса', () => {
    expect(transferRate({ currency: 'KGS', amount: 100 }, { currency: 'KGS', amount: 100 })).toBeUndefined();
  });
  it('обновление последнего курса', () => {
    const settings: Settings = { key: 'main', smallExpenseThreshold: 30_000, theme: 'system' };
    expect(rateUpdateAfter(transfer, settings)).toEqual({ lastUsdtRate: 875_000, lastUsdtRateDate: '2026-11-02' });
    expect(rateUpdateAfter(transfer, { ...settings, lastUsdtRateDate: '2026-11-03', lastUsdtRate: 880_000 })).toBeNull();
    expect(rateUpdateAfter(expense, settings)).toBeNull();
  });
});
