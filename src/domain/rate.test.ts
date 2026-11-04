import { describe, expect, it } from 'vitest';
import { computeBalances } from './balance';
import { monthTotals } from './history';
import { formatRate, formatRatePrecise } from './money';
import { crossRate, rateAfterDelete, rateBook, rateFromAmounts, rateOn, rateUpdateAfter, savedRate, toKgs, transferRate } from './rate';
import type { Account, Settings, Transaction } from './types';

const account = (id: string, currency: string, opening = 0): Account => ({
  id, name: id, type: currency === 'KGS' ? 'bank' : 'crypto', currency, icon: 'Landmark', color: '#2448D6',
  includeInDaily: currency === 'KGS', openingBalance: opening, openingDate: '2026-11-01', sortOrder: 0, archived: false,
});
const accounts = [account('mbank', 'KGS', 1_000_000), account('usdt', 'USDT', 50_000), account('usd', 'USD', 30_000), account('eur', 'EUR')];
const byId = new Map(accounts.map((a) => [a.id, a]));
const settings: Settings = { key: 'main', smallExpenseThreshold: 30_000, theme: 'system' };
let n = 0;
const transfer = (from: string, to: string, amount: number, toAmount: number, date = '2026-11-02'): Transaction => {
  const t: Transaction = { id: `t${n++}`, type: 'transfer', date, accountId: from, amount, toAccountId: to, toAmount, createdAt: n, updatedAt: n };
  const rate = transferRate({ currency: byId.get(from)!.currency, amount }, { currency: byId.get(to)!.currency, amount: toAmount });
  return rate ? { ...t, rate } : t;
};

describe('курс и пересчёт', () => {
  it('200 USDT → 17 500 сом = 87,50', () => {
    expect(rateFromAmounts(1_750_000, 20_000)).toBe(875_000);
  });
  it('в сомы — до целого сома', () => {
    expect(toKgs(20_000, 875_000)).toBe(1_750_000);
    expect(toKgs(1, 875_000)).toBe(100); // 0,875 сом → 1 сом
    expect(toKgs(1_234, 875_000)).toBe(108_000); // 12,34 × 87,50 = 1 079,75 → 1 080
  });
  it('курс на дату: последний до, иначе первый после', () => {
    const book = rateBook([transfer('usdt', 'mbank', 10_000, 880_000, '2026-10-20'), transfer('usdt', 'mbank', 10_000, 870_000, '2026-10-05')], byId);
    const h = book.get('USDT');
    expect(rateOn(h, '2026-10-21')).toBe(880_000);
    expect(rateOn(h, '2026-10-05')).toBe(870_000);
    expect(rateOn(h, '2026-09-01')).toBe(870_000);
    expect(rateOn(undefined, '2026-12-01')).toBeUndefined();
  });
});

describe('перевод 200 USDT → 17 500 сом (приёмка этапа 4)', () => {
  const t = transfer('usdt', 'mbank', 20_000, 1_750_000);
  const expense: Transaction = { id: 'e', type: 'expense', date: '2026-11-02', accountId: 'mbank', amount: 25_000, categoryId: 'cafe', createdAt: 1, updatedAt: 1 };
  it('курс 87,50, балансы, доходы и расходы месяца не изменились', () => {
    expect(formatRate(t.rate!)).toBe('87,50');
    const b = computeBalances(accounts, [expense, t]);
    expect(b.get('usdt')).toBe(30_000);
    expect(b.get('mbank')).toBe(1_000_000 - 25_000 + 1_750_000);
    expect(monthTotals([expense, t], byId, new Map())).toEqual(monthTotals([expense], byId, new Map()));
  });
});

describe('валюты (SPEC 4.6)', () => {
  it('обмен 100 USD → 8 730 сом даёт курс USD 87,30 (приёмка этапа 11)', () => {
    const t = transfer('usd', 'mbank', 10_000, 873_000);
    expect(formatRate(t.rate!)).toBe('87,30');
    expect(rateUpdateAfter(t, settings, byId)).toEqual({ rates: { USD: { rate: 873_000, date: '2026-11-02' } } });
  });
  it('сом → EUR: тот же «сом за 1 EUR», курс USDT не трогается', () => {
    const t = transfer('mbank', 'eur', 951_500, 10_000);
    expect(t.rate).toBe(951_500);
    const withUsdt = { ...settings, rates: { USDT: { rate: 875_000, date: '2026-11-01' } } };
    expect(rateUpdateAfter(t, withUsdt, byId)).toEqual({
      rates: { USDT: { rate: 875_000, date: '2026-11-01' }, EUR: { rate: 951_500, date: '2026-11-02' } },
    });
  });
  it('USD → USDT без сома: курс не пишется, есть кросс-курс', () => {
    const t = transfer('usd', 'usdt', 10_000, 9_950);
    expect(t.rate).toBeUndefined();
    expect(rateUpdateAfter(t, settings, byId)).toBeNull();
    expect(formatRatePrecise(crossRate(10_000, 9_950)!)).toBe('0,9950');
  });
  it('обмен задним числом не перетирает более свежий курс', () => {
    const t = transfer('usd', 'mbank', 10_000, 873_000, '2026-10-01');
    expect(rateUpdateAfter(t, { ...settings, rates: { USD: { rate: 880_000, date: '2026-11-01' } } }, byId)).toBeNull();
  });
  it('история курсов по каждой валюте + ручная правка', () => {
    const book = rateBook(
      [transfer('usd', 'mbank', 10_000, 873_000), transfer('usdt', 'mbank', 10_000, 875_000), transfer('usd', 'usdt', 10_000, 9_950)],
      byId,
      { ...settings, rates: { EUR: { rate: 950_000, date: '2026-11-03' } } },
    );
    expect([...book.keys()].sort()).toEqual(['EUR', 'USD', 'USDT']);
    expect(rateOn(book.get('EUR'), '2026-11-04')).toBe(950_000);
  });
  it('курс USDT старого формата читается', () => {
    expect(savedRate({ ...settings, lastUsdtRate: 875_000, lastUsdtRateDate: '2026-11-02' }, 'USDT')).toEqual({ rate: 875_000, date: '2026-11-02' });
    expect(savedRate(settings, 'USD')).toBeUndefined();
  });
});

describe('курс после удаления обмена', () => {
  const older = transfer('usdt', 'mbank', 10_000, 870_000, '2026-11-01'); // 87,00
  const newer = transfer('usdt', 'mbank', 10_000, 880_000, '2026-11-03'); // 88,00
  const withRate = (t: Transaction): Settings => ({ ...settings, rates: { USDT: { rate: t.rate!, date: t.date } } });

  it('курс из удалённого обмена заменяется последним из оставшихся', () => {
    expect(rateAfterDelete(newer, withRate(newer), [older, newer], byId)).toEqual({ rates: { USDT: { rate: 870_000, date: '2026-11-01' } } });
  });
  it('курс не из этого обмена не трогается', () => {
    expect(rateAfterDelete(older, withRate(newer), [older, newer], byId)).toBeNull();
  });
  it('других обменов нет — курс остаётся', () => {
    expect(rateAfterDelete(newer, withRate(newer), [newer], byId)).toBeNull();
  });
  it('обычная трата и перевод без курса — ничего', () => {
    const same = transfer('mbank', 'mbank', 100, 100);
    expect(rateAfterDelete(same, withRate(newer), [same], byId)).toBeNull();
  });
});
