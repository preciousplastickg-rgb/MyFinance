import { describe, expect, it } from 'vitest';
import { rateFromAmounts, rateHistory, rateOn, usdtToKgs } from './rate';
import type { Transaction } from './types';

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
