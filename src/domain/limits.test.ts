import { describe, expect, it } from 'vitest';
import { categoryLimits, hasLimit, limitCaption, limitHint, limitsSummary } from './limits';
import type { Account, Category, Transaction } from './types';

// Приёмка этапа 23 (SPEC 4.9): «Кафе» с лимитом 6 000, траты 4 200 → 70%, осталось 1 800, по 85 в день до конца ноября.
const TODAY = '2026-11-10';
const MONTH = '2026-11';
const acc = (id: string, currency: Account['currency'] = 'KGS'): Account => ({
  id, name: id, type: 'bank', currency, icon: 'Landmark', color: 'blue', includeInDaily: true, openingBalance: 0, openingDate: '2026-01-01', sortOrder: 0, archived: false,
});
const cat = (id: string, extra: Partial<Category> = {}): Category => ({
  id, name: id, kind: 'expense', icon: 'Coffee', color: 'amber', isFixed: false, sortOrder: 0, archived: false, ...extra,
});
const accountById = new Map([acc('mbank'), acc('usd', 'USD')].map((a) => [a.id, a]));
let n = 0;
const tx = (categoryId: string, amount: number, date = '2026-11-05', extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${n++}`, type: 'expense', date, accountId: 'mbank', amount, categoryId, createdAt: n, updatedAt: n, ...extra,
});
const cafe = cat('cafe', { name: 'Кафе', limit: 600_000, sortOrder: 1 });
const food = cat('food', { name: 'Продукты', limit: 2_500_000, sortOrder: 0 });
const taxi = cat('taxi', { name: 'Такси' });
const base = { month: MONTH, today: TODAY, categories: [cafe, food, taxi], accountById, rates: new Map() };

describe('categoryLimits', () => {
  it('контрольный пример: 4 200 из 6 000 → 70%, осталось 1 800, по 85 в день (21 день до конца ноября)', () => {
    const views = categoryLimits({ ...base, transactions: [tx('cafe', 300_000), tx('cafe', 120_000, '2026-11-09')] });
    const v = views.find((x) => x.category.id === 'cafe')!;
    expect(v).toMatchObject({ limit: 600_000, spent: 420_000, count: 2, left: 180_000, percent: 70, status: 'ok', perDay: 8_500 });
    expect(limitCaption(v)).toEqual({ text: 'осталось 1 800 · по 85 в день', warn: false });
  });
  it('ещё 2 500 → перерасход 700, полоса 100%, perDay нет', () => {
    const v = categoryLimits({ ...base, transactions: [tx('cafe', 420_000), tx('cafe', 250_000)] })[0]!;
    expect(v).toMatchObject({ category: cafe, spent: 670_000, left: -70_000, percent: 100, status: 'over' });
    expect(v.perDay).toBeUndefined();
    expect(limitCaption(v)).toEqual({ text: 'перерасход 700', warn: true });
  });
  it('ровно лимит — исчерпан; ≥ 80% — на грани', () => {
    expect(categoryLimits({ ...base, transactions: [tx('cafe', 600_000)] })[0]).toMatchObject({ left: 0, status: 'over' });
    const near = categoryLimits({ ...base, transactions: [tx('cafe', 480_000)] })[0]!;
    expect(near).toMatchObject({ percent: 80, status: 'near' });
    expect(limitCaption(near).warn).toBe(true);
  });
  it('валютная трата считается по курсу операции: 10 USD по 87,50 = 875 сом', () => {
    const v = categoryLimits({ ...base, transactions: [tx('cafe', 1_000, '2026-11-05', { accountId: 'usd', rate: 875_000 })] })[0]!;
    expect(v.spent).toBe(87_500);
    expect(v.approx).toBe(false);
  });
  it('категории без лимита, архивные и доходы не попадают; без трат — 0%; порядок по заполненности', () => {
    const archived = cat('old', { limit: 100_000, archived: true });
    const income = cat('salary', { kind: 'income', limit: 100_000 });
    const views = categoryLimits({ ...base, categories: [cafe, food, taxi, archived, income], transactions: [tx('taxi', 50_000), tx('food', 500_000)] });
    expect(views.map((v) => v.category.id)).toEqual(['food', 'cafe']);
    expect(views[1]).toMatchObject({ spent: 0, percent: 0, status: 'ok', perDay: 28_500 });
    expect(hasLimit(cat('x', { limit: 0 }))).toBe(false);
  });
  it('другой месяц: траты других месяцев не считаются, perDay нет', () => {
    const views = categoryLimits({ ...base, month: '2026-10', transactions: [tx('cafe', 100_000, '2026-10-20'), tx('cafe', 999_000, '2026-11-02')] });
    expect(views[0]).toMatchObject({ category: cafe, spent: 100_000 });
    expect(views[0]!.perDay).toBeUndefined();
    expect(limitCaption(views[0]!)).toEqual({ text: 'осталось 5 000', warn: false });
  });
  it('без категорий с лимитом — пустой список', () => {
    expect(categoryLimits({ ...base, categories: [taxi], transactions: [tx('taxi', 50_000)] })).toEqual([]);
  });
});

describe('limitsSummary и limitHint', () => {
  it('подпись блока', () => {
    const views = (spent: number[]) => categoryLimits({ ...base, categories: spent.map((_, i) => cat(`c${i}`, { limit: 100_000 })), transactions: spent.map((s, i) => tx(`c${i}`, s)) });
    expect(limitsSummary(views([10_000, 20_000])).text).toBe('всё в рамках');
    expect(limitsSummary(views([85_000, 20_000])).text).toBe('1 на грани');
    expect(limitsSummary(views([120_000, 100_000, 10_000])).text).toBe('2 превышены');
    expect(limitsSummary(views([120_000])).text).toBe('1 превышен');
  });
  it('подсказка в форме записи', () => {
    const v = { limit: 600_000, spent: 420_000 };
    expect(limitHint(v, 0)).toEqual({ text: 'Осталось 1 800 из 6 000', warn: false });
    expect(limitHint(v, 25_000)).toEqual({ text: 'Останется 1 550 из 6 000', warn: false });
    expect(limitHint(v, 100_000)).toEqual({ text: 'Останется 800 из 6 000', warn: true });
    expect(limitHint(v, 250_000)).toEqual({ text: 'Превысит лимит 6 000 на 700', warn: true });
    expect(limitHint(v, 180_000)).toEqual({ text: 'Лимит 6 000 будет исчерпан', warn: true });
    expect(limitHint({ limit: 600_000, spent: 640_000 }, 0)).toEqual({ text: 'Лимит 6 000 превышен на 400', warn: true });
    expect(limitHint({ limit: 600_000, spent: 600_000 }, 0)).toEqual({ text: 'Лимит 6 000 исчерпан', warn: true });
  });
});

describe('«Где можно сократить»: сверх лимита', () => {
  it('карточка «Кафе сверх лимита» есть и без 30 дней записей; рост той же категории не дублируется', async () => {
    const { monthReport } = await import('./reports');
    const txs = [tx('cafe', 300_000, '2026-11-03'), tx('cafe', 340_000, '2026-11-04')];
    const r = monthReport({
      month: MONTH, today: TODAY, transactions: txs, accountById, categoryById: new Map([[cafe.id, cafe]]), recurring: [], rates: new Map(),
      settings: { smallExpenseThreshold: 20_000 } as never,
    });
    expect(r.comparisons).toBe(false);
    expect(r.insights).toHaveLength(1);
    expect(r.insights[0]).toMatchObject({ kind: 'limit', title: 'Кафе сверх лимита', gain: '+400', categoryId: 'cafe' });
    expect(r.insights[0]!.text).toBe('6 400 сом в ноябре при лимите 6 000. 2 покупки, средний чек 3 200');
    expect(r.insights.filter((i) => i.kind === 'growth')).toHaveLength(0);
  });
});
