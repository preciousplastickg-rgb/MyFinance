import { describe, expect, it } from 'vitest';
import { generateSeed } from '../dev/seedData';
import { computeBalances } from './balance';
import { addMonths, monthOf } from './date';
import { groupByDay, monthTotals, totalExpenseKgs } from './history';
import { rateBook } from './rate';
import { categoryCard, categoryShares, categoryTrend, deltaPercent, monthReport, type CategoryStat, type ReportInput } from './reports';
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
      expect(report.byCategory.reduce((s, x) => s + x.total, 0)).toBe(report.totalExpense);
      expect(report.fixed + report.variable).toBe(report.totalExpense);
      // и с итогами дней в истории: доходы − расходы
      const net = groupByDay(inMonth, accountById, rates).reduce((s, g) => s + g.total, 0);
      expect(net).toBe(report.totalIncome - report.totalExpense);
    });
  }

  it('расходы по счетам: сумма по счетам равна итогу расходов, по убыванию', () => {
    const r = monthReport(input('2026-10'));
    expect(r.byAccount.length).toBeGreaterThan(1);
    expect(r.byAccount.reduce((s, a) => s + a.total, 0)).toBe(r.totalExpense);
    expect(r.byAccount.map((a) => a.total)).toEqual([...r.byAccount.map((a) => a.total)].sort((a, b) => b - a));
    expect(r.byAccount.reduce((s, a) => s + a.ids.length, 0)).toBe(seed.transactions.filter((t) => t.type === 'expense' && t.date.startsWith('2026-10')).length);
  });
  // Этап 30: «Куда ушли деньги» вместо кольца — все категории месяца строками, без «Прочего».
  for (const month of [monthOf(TODAY), addMonths(monthOf(TODAY), -1), addMonths(monthOf(TODAY), -2)]) {
    it(`${month}: строки «Куда ушли деньги» = расходы месяца до тыйына, доли — ровно 100%`, () => {
      const report = monthReport(input(month));
      const inMonth = seed.transactions.filter((t) => monthOf(t.date) === month);
      expect(report.byCategory.reduce((s, c) => s + c.total, 0)).toBe(totalExpenseKgs(monthTotals(inMonth, accountById, rates)));
      const shares = categoryShares(report.byCategory);
      expect(shares).toHaveLength(report.byCategory.length);
      expect(shares.reduce((s, x) => s + x.percent, 0)).toBe(100);
      // Самая большая — первая, её полоса во всю длину; строки по убыванию.
      expect(shares[0]!.rel).toBe(100);
      const totals = report.byCategory.map((c) => c.total);
      expect(totals).toEqual([...totals].sort((a, b) => b - a));
    });
  }
  it('в списке все категории месяца — больше шести, без «Прочего»', () => {
    const report = monthReport(input(addMonths(monthOf(TODAY), -1)));
    expect(report.byCategory.length).toBeGreaterThan(6);
    expect(report.byCategory.some((c) => c.category.name === 'Прочее' && c.category.id === '__rest')).toBe(false);
  });

  it('карточки «Где можно сократить»: рост кафе, подписки, мелкие траты', () => {
    // Без лимитов (этап 23): категория сверх лимита заменяет карточку роста, а здесь проверяется сам рост.
    const noLimits = new Map(seed.categories.map((c) => [c.id, { ...c, limit: undefined }]));
    const report = monthReport({ ...input(addMonths(monthOf(TODAY), -1)), categoryById: noLimits });
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
      { kind: 'subscriptions', title: 'Подписки', text: '4 подписки, 800 сом в месяц = 9\u00A0600 в год', amount: 80_000, gain: '9\u00A0600 в год' },
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

  it('текущий месяц сравнивается с тем же числом прошлых месяцев, а не с полными', () => {
    const c: Category = { id: 'c', name: 'Кафе', kind: 'expense', icon: 'Coffee', color: '#B45309', isFixed: false, sortOrder: 0, archived: false };
    const t = (date: string, amount: number): Transaction => ({ id: date + amount, type: 'expense', date, accountId: seed.accounts[0]!.id, amount, categoryId: 'c', createdAt: 0, updatedAt: 0 });
    const base = { today: '2026-11-04', accountById, categoryById: new Map([['c', c]]), recurring: [], rates: new Map(), settings: seed.settings };
    // В сентябре и октябре: 1 000 к 4-му числу и ещё 9 000 позже. В ноябре к 4-му — 1 000: это норма, а не −90%.
    const transactions = ['2026-09', '2026-10'].flatMap((m) => [t(`${m}-02`, 100_000), t(`${m}-20`, 900_000)]);
    const report = monthReport({ ...base, month: '2026-11', transactions: [...transactions, t('2026-11-03', 100_000)] });
    expect(report.sameDay).toBe(4);
    expect(report.byCategory[0]!.average).toBe(100_000);
    expect(report.byCategory[0]!.delta).toBeUndefined();
    // Прошлый месяц уже закончился — сравнение с полными месяцами.
    const october = monthReport({ ...base, month: '2026-10', transactions });
    expect(october.sameDay).toBeUndefined();
  });
});

describe('среднее по категории — целые сомы', () => {
  it('average делится до сома', () => {
    const r = monthReport(input(monthOf(TODAY)));
    for (const c of r.byCategory) if (c.average !== undefined) expect(c.average % 100).toBe(0);
  });
});

describe('доход в валюте без курса', () => {
  it('не теряется: сумма в своей валюте в noRate, в итог не входит', () => {
    const usd: Transaction = { id: 'u', type: 'income', date: `${monthOf(TODAY)}-03`, accountId: 'usd', amount: 50_000, categoryId: seed.categories[0]!.id, createdAt: 1, updatedAt: 1 };
    const account = { ...seed.accounts[0]!, id: 'usd', name: 'USD', currency: 'USD' };
    const r = monthReport({ ...input(monthOf(TODAY)), transactions: [usd], accountById: new Map([[account.id, account]]) });
    expect(r.incomes).toHaveLength(1);
    expect(r.incomes[0]!.noRate).toEqual([{ currency: 'USD', amount: 50_000 }]);
    expect(r.totalIncome).toBe(0);
  });
});

describe('«Куда ушли деньги» (этап 30)', () => {
  const cat = (id: string, isFixed = false): Category => ({ id, name: id, kind: 'expense', icon: 'Coffee', color: 'amber', isFixed, sortOrder: 0, archived: false });
  const stat = (id: string, total: number, extra: Partial<CategoryStat> = {}): CategoryStat => ({ category: cat(id), total, count: 1, approx: false, ...extra });

  it('доли целыми процентами в сумме ровно 100: остатки достаются самым большим', () => {
    // 1/3 + 1/3 + 1/3: округлением вниз 33 + 33 + 33 = 99 — лишний процент получает первая.
    expect(categoryShares([stat('a', 100), stat('b', 100), stat('c', 100)]).map((x) => x.percent)).toEqual([34, 33, 33]);
    // 66,7 / 33,3 → 67 и 33.
    expect(categoryShares([stat('a', 200), stat('b', 100)]).map((x) => x.percent)).toEqual([67, 33]);
    expect(categoryShares([stat('a', 300), stat('b', 150)]).map((x) => x.rel)).toEqual([100, 50]);
    expect(categoryShares([])).toEqual([]);
  });

  it('раскрытая строка переменной категории: доля, обычно, за полгода с первого месяца с данными, покупки и средний чек', () => {
    const s = stat('cafe', 560_000, { count: 22, average: 406_000 });
    const trend = [
      { month: '2026-06', total: 0 }, { month: '2026-07', total: 0 }, { month: '2026-08', total: 390_000 },
      { month: '2026-09', total: 410_000 }, { month: '2026-10', total: 400_000 }, { month: '2026-11', total: 560_000 },
    ];
    // Записи с 1 августа, отчёт за ноябрь после его конца: полные месяцы — август…ноябрь.
    const card = categoryCard(s, 15, trend, [], '2026-08-01', '2026-12-02');
    expect(card).toMatchObject({ share: 15, usual: 406_000, range: { min: 390_000, max: 560_000 }, purchases: { count: 22, avgCheck: 25_500 } });
    expect(card.trend).toHaveLength(6);
    expect(card.source).toBeUndefined();
    // Неполные месяцы в «за полгода» не идут: первый (начали 3 августа) и текущий (ноябрь ещё идёт) — остаются сентябрь и октябрь.
    expect(categoryCard(s, 15, trend, [], '2026-08-03', '2026-11-08').range).toEqual({ min: 400_000, max: 410_000 });
    // Полных месяцев меньше двух — диапазона нет.
    expect(categoryCard(s, 15, trend, [], '2026-10-05', '2026-11-08').range).toBeUndefined();
  });

  it('обязательная категория: источник — регулярный платёж и его день, покупок нет', () => {
    const rent = { ...stat('rent', 1_500_000), category: cat('rent', true) };
    const recurring = seed.recurring.filter((r) => r.kind === 'expense').slice(0, 1).map((r) => ({ ...r, categoryId: 'rent', name: 'Аренда', schedule: { type: 'monthly' as const, day: 1 } }));
    const card = categoryCard(rent, 40, [], recurring);
    expect(card.source).toBe('Аренда · 1-го числа');
    expect(card.purchases).toBeUndefined();
  });

  it('на seed: у категорий с покупками средний чек = сумма / покупки до сома', () => {
    const report = monthReport(input(addMonths(monthOf(TODAY), -1)));
    const shares = categoryShares(report.byCategory);
    for (const [i, s] of report.byCategory.entries()) {
      const card = categoryCard(s, shares[i]!.percent, categoryTrend(s.category.id, report.month, seed.transactions, accountById, rates), seed.recurring, report.firstDate, TODAY);
      if (card.purchases) expect(Math.abs(card.purchases.avgCheck * card.purchases.count - s.total)).toBeLessThanOrEqual(50 * card.purchases.count);
      expect(card.trend.at(-1)!.total).toBe(s.total);
    }
  });
});

