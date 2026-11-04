import { describe, expect, it } from 'vitest';
import { generateSeed } from '../dev/seedData';
import { computeBalances } from './balance';
import { addMonths, monthOf } from './date';
import { groupByDay, monthTotals, totalExpenseKgs } from './history';
import { rateBook } from './rate';
import { categoryTrend, deltaPercent, monthReport, type ReportInput } from './reports';
import type { Category, Transaction } from './types';

const TODAY = '2026-11-04';
const seed = generateSeed(TODAY);
const accountById = new Map(seed.accounts.map((a) => [a.id, a]));
const categoryById = new Map(seed.categories.map((c) => [c.id, c]));
const rates = rateBook(seed.transactions, accountById, seed.settings);
const input = (month: string, transactions: readonly Transaction[] = seed.transactions): ReportInput => ({
  month, today: TODAY, transactions, accountById, categoryById, recurring: seed.recurring, rates, settings: seed.settings,
});

describe('seed', () => {
  it('3 месяца данных, 5 счетов, 2 источника дохода, аренда/интернет/связь и 4 подписки', () => {
    expect(seed.accounts.map((a) => a.name)).toEqual(['MBank', 'О!Банк', 'Оптима', 'Наличные', 'USDT']);
    expect(seed.recurring.filter((r) => r.kind === 'income').map((r) => r.currency)).toEqual(['KGS', 'USDT']);
    expect(seed.recurring.filter((r) => r.isSubscription)).toHaveLength(4);
    expect(seed.transactions.length).toBeGreaterThan(200);
    expect(seed.transactions.every((t) => Number.isSafeInteger(t.amount) && t.amount > 0)).toBe(true);
    const balances = [...computeBalances(seed.accounts, seed.transactions).values()];
    expect(balances.every(Number.isSafeInteger)).toBe(true);
    expect(balances.every((b) => b >= 0)).toBe(true);
  });
});

describe('отчёт за месяц на seed-данных (приёмка этапа 6)', () => {
  for (const month of [monthOf(TODAY), addMonths(monthOf(TODAY), -1), addMonths(monthOf(TODAY), -2)]) {
    it(`${month}: сумма диаграммы = расходы месяца в истории до сома`, () => {
      const report = monthReport(input(month));
      const inMonth = seed.transactions.filter((t) => monthOf(t.date) === month);
      const totals = monthTotals(inMonth, accountById, rates);
      expect(report.totalExpense).toBe(totalExpenseKgs(totals));
      expect(report.segments.reduce((s, x) => s + x.total, 0)).toBe(report.totalExpense);
      expect(report.byCategory.reduce((s, x) => s + x.total, 0)).toBe(report.totalExpense);
      expect(report.fixed + report.variable).toBe(report.totalExpense);
      // и с итогами дней в истории: доходы − расходы
      const net = groupByDay(inMonth, accountById, rates).reduce((s, g) => s + g.total, 0);
      expect(net).toBe(report.totalIncome - report.totalExpense);
    });
  }

  it('до 6 сегментов, остальное — «Прочее»; в легенде все категории', () => {
    const report = monthReport(input(addMonths(monthOf(TODAY), -1)));
    expect(report.byCategory.length).toBeGreaterThan(6);
    expect(report.segments).toHaveLength(7);
    expect(report.segments[6]!.name).toBe('Прочее');
    const totals = report.byCategory.map((c) => c.total);
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
  });

  it('карточки «Где можно сократить»: рост кафе, подписки, мелкие траты', () => {
    const report = monthReport(input(addMonths(monthOf(TODAY), -1)));
    expect(report.comparisons).toBe(true);
    const kinds = report.insights.map((i) => i.kind);
    expect(kinds).toContain('small');
    const growth = report.insights.find((i) => i.title.startsWith('Кафе'));
    expect(growth?.title).toMatch(/^Кафе \+\d+%$/);
    expect(growth?.text).toMatch(/сом в октябре при обычных .* \(среднее за 3 месяца\)\. \d+ покуп\S+, средний чек/);
    expect(report.insights.find((i) => i.kind === 'small')?.text).toMatch(/^\d+ покуп\S+, [\d\u00A0]+ сом — \d+% всех расходов$/);
    expect(report.insights.length).toBe(3);
    const amounts = report.insights.map((i) => i.amount);
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
  });

  it('доходы по источникам, USDT ≈ в сомах', () => {
    const report = monthReport(input(addMonths(monthOf(TODAY), -1)));
    const names = report.incomes.map((i) => i.name);
    expect(names).toEqual(expect.arrayContaining(['Зарплата', 'Зарплата 2 (USDT)']));
    expect(report.incomes.find((i) => i.name === 'Зарплата 2 (USDT)')?.approx).toBe(true);
  });

  it('меньше 30 дней записей — без сравнений и карточек', () => {
    const recent = seed.transactions.filter((t) => t.date >= '2026-10-20');
    const report = monthReport(input('2026-11', recent));
    expect(report.comparisons).toBe(false);
    expect(report.insights).toEqual([]);
    expect(report.byCategory.every((c) => c.delta === undefined)).toBe(true);
  });

  it('столбцы за 6 месяцев', () => {
    const cafe = seed.categories.find((c) => c.name === 'Кафе')!.id;
    const trend = categoryTrend(cafe, '2026-10', seed.transactions, accountById, rates);
    expect(trend.map((t) => t.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(trend[5]!.total).toBe(monthReport(input('2026-10')).byCategory.find((c) => c.category.id === cafe)!.total);
  });
});

describe('карточка «Подписки»', () => {
  it('4 подписки, 800 сом в месяц = 9 600 в год', () => {
    const t = (date: string): Transaction => ({ id: date, type: 'expense', date, accountId: seed.accounts[0]!.id, amount: 500_000, categoryId: seed.categories[0]!.id, createdAt: 0, updatedAt: 0 });
    const transactions = ['2026-08-15', '2026-09-15', '2026-10-15'].map(t);
    const report = monthReport({ ...input('2026-10', transactions) });
    expect(report.insights).toEqual([
      { kind: 'subscriptions', title: 'Подписки', text: '4 подписки, 800 сом в месяц = 9\u00A0600 в год', amount: 80_000 },
    ]);
  });
});

describe('правила сравнения', () => {
  it('Δ к среднему: показывается при |Δ| ≥ 10%', () => {
    expect(deltaPercent(560_000, 406_000)).toBe(38);
    expect(deltaPercent(105, 100)).toBeUndefined();
    expect(deltaPercent(90, 100)).toBe(-10);
    expect(deltaPercent(100, 0)).toBeUndefined();
  });

  it('нужно ≥ 2 месяцев данных из 3 предыдущих', () => {
    const c: Category = { id: 'c', name: 'Кафе', kind: 'expense', icon: 'Coffee', color: '#B45309', isFixed: false, sortOrder: 0, archived: false };
    const t = (date: string, amount: number): Transaction => ({ id: date + amount, type: 'expense', date, accountId: seed.accounts[0]!.id, amount, categoryId: 'c', createdAt: 0, updatedAt: 0 });
    const base = { today: '2026-11-04', accountById, categoryById: new Map([['c', c]]), recurring: [], rates: new Map(), settings: seed.settings };
    const one = monthReport({ ...base, month: '2026-10', transactions: [t('2026-09-01', 100_000), t('2026-10-01', 200_000)] });
    expect(one.byCategory[0]!.delta).toBeUndefined();
    const two = monthReport({ ...base, month: '2026-10', transactions: [t('2026-08-01', 100_000), t('2026-09-01', 100_000), t('2026-10-01', 200_000)] });
    expect(two.byCategory[0]!.delta).toBe(100);
    expect(two.insights.map((i) => i.kind)).toContain('growth');
  });
});
