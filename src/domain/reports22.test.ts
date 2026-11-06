import { describe, expect, it } from 'vitest';
import { generateSeed } from '../dev/seedData';
import { computeBalances } from './balance';
import { addDays, addMonths, monthOf } from './date';
import { rateBook } from './rate';
import { accountFlows, monthReport, monthSummary, paceSeries, TOP_GROWTH_MIN, type ReportInput } from './reports';
import type { Account, Category, Transaction } from './types';

// Приёмка этапа 22 (SPEC 6, раздел 10).
const TODAY = '2026-11-04';
const seed = generateSeed(TODAY);
const accountById = new Map(seed.accounts.map((a) => [a.id, a]));
const categoryById = new Map(seed.categories.map((c) => [c.id, c]));
const rates = rateBook(seed.transactions, accountById, seed.settings);
const input = (month: string, transactions: readonly Transaction[] = seed.transactions): ReportInput => ({
  month, today: TODAY, transactions, accountById, categoryById, recurring: seed.recurring, rates, settings: seed.settings,
});
const flowsInput = (month: string, transactions: readonly Transaction[] = seed.transactions, accounts: readonly Account[] = seed.accounts) => ({
  month, today: TODAY, accounts, transactions, accountById: new Map(accounts.map((a) => [a.id, a])), categoryById, recurring: seed.recurring,
});
const months = [monthOf(TODAY), addMonths(monthOf(TODAY), -1), addMonths(monthOf(TODAY), -2), addMonths(monthOf(TODAY), -3)];

describe('«По счетам»: движение денег', () => {
  for (const month of months) {
    it(`${month}: начало + пришло − ушло = конец, и конец совпадает с балансом по 4.1 до тыйына`, () => {
      const { to, flows } = accountFlows(flowsInput(month));
      expect(flows.length).toBe(seed.accounts.filter((a) => a.type !== 'savings').length);
      const balances = computeBalances(seed.accounts, seed.transactions.filter((t) => t.date <= to));
      for (const f of flows) {
        expect(f.start + f.inflow - f.outflow).toBe(f.end);
        expect(f.end).toBe(balances.get(f.account.id));
        expect(f.lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0)).toBe(f.inflow);
        expect(f.lines.filter((l) => l.amount < 0).reduce((s, l) => s - l.amount, 0)).toBe(f.outflow);
      }
    });
  }

  it('начало месяца = конец прошлого', () => {
    const oct = accountFlows(flowsInput('2026-10')).flows;
    const sep = accountFlows(flowsInput('2026-09')).flows;
    for (const f of oct) expect(f.start).toBe(sep.find((x) => x.account.id === f.account.id)!.end);
  });

  it('перевод 5 000 MBank → Наличные: у MBank «ушло» +5 000, у Наличных «пришло» +5 000, расходы и доходы месяца не изменились', () => {
    const mbank = seed.accounts.find((a) => a.name === 'MBank')!;
    const cash = seed.accounts.find((a) => a.name === 'Наличные')!;
    const extra: Transaction = { id: 'x-transfer', type: 'transfer', date: '2026-10-17', accountId: mbank.id, amount: 500_000, toAccountId: cash.id, toAmount: 500_000, createdAt: 0, updatedAt: 0 };
    const before = accountFlows(flowsInput('2026-10')).flows;
    const after = accountFlows(flowsInput('2026-10', [...seed.transactions, extra])).flows;
    const pick = (fl: typeof before, id: string) => fl.find((f) => f.account.id === id)!;
    expect(pick(after, mbank.id).outflow - pick(before, mbank.id).outflow).toBe(500_000);
    expect(pick(after, mbank.id).inflow).toBe(pick(before, mbank.id).inflow);
    expect(pick(after, cash.id).inflow - pick(before, cash.id).inflow).toBe(500_000);
    expect(pick(after, cash.id).lines.find((l) => l.key === `from:${mbank.id}`)?.label).toBe('С MBank');
    const r0 = monthReport(input('2026-10'));
    const r1 = monthReport(input('2026-10', [...seed.transactions, extra]));
    expect([r1.totalExpense, r1.totalIncome]).toEqual([r0.totalExpense, r0.totalIncome]);
  });

  it('копилка не строка, а «В копилки» у счёта-источника; долги — отдельными строками', () => {
    const mbank = seed.accounts.find((a) => a.name === 'MBank')!;
    const jar: Account = { ...mbank, id: 'jar', name: 'Фонд', type: 'savings', openingBalance: 0, openingDate: '2026-01-01', sortOrder: 99 };
    const accounts = [...seed.accounts, jar];
    const t: Transaction = { id: 'x-jar', type: 'transfer', date: '2026-10-20', accountId: mbank.id, amount: 300_000, toAccountId: 'jar', toAmount: 300_000, createdAt: 0, updatedAt: 0 };
    const { flows } = accountFlows(flowsInput('2026-10', [...seed.transactions, t], accounts));
    expect(flows.some((f) => f.account.id === 'jar')).toBe(false);
    const m = flows.find((f) => f.account.id === mbank.id)!;
    expect(m.lines.find((l) => l.key === 'toSav')).toMatchObject({ label: 'В копилки', amount: -300_000 });
    expect(m.lines.map((l) => l.key)).toEqual(expect.arrayContaining(['debtIn', 'debtOut']));
  });

  it('счёт заведён в середине месяца: начало = начальный остаток на дату, операции раньше неё не считаются', () => {
    const a: Account = { ...seed.accounts[0]!, id: 'new', name: 'Новый', openingBalance: 1_000_000, openingDate: '2026-10-10', sortOrder: 50 };
    const tx = (id: string, date: string, amount: number): Transaction => ({ id, type: 'expense', date, accountId: 'new', amount, categoryId: seed.categories[0]!.id, createdAt: 0, updatedAt: 0 });
    const { flows } = accountFlows(flowsInput('2026-10', [tx('a', '2026-10-05', 50_000), tx('b', '2026-10-12', 20_000)], [a]));
    expect(flows[0]).toMatchObject({ start: 1_000_000, startDate: '2026-10-10', outflow: 20_000, end: 980_000 });
    expect(accountFlows(flowsInput('2026-09', [], [a])).flows).toEqual([]);
  });

  it('текущий месяц — по сегодня: операции после сегодня не входят', () => {
    const mbank = seed.accounts.find((a) => a.name === 'MBank')!;
    const future: Transaction = { id: 'x-future', type: 'expense', date: addDays(TODAY, 3), accountId: mbank.id, amount: 100_000, categoryId: seed.categories[0]!.id, createdAt: 0, updatedAt: 0 };
    const a = accountFlows(flowsInput('2026-11')).flows.find((f) => f.account.id === mbank.id)!;
    const b = accountFlows(flowsInput('2026-11', [...seed.transactions, future])).flows.find((f) => f.account.id === mbank.id)!;
    expect(b.end).toBe(a.end);
    expect(accountFlows(flowsInput('2026-11')).to).toBe(TODAY);
  });
});

describe('«Темп месяца»', () => {
  for (const month of months.slice(1)) {
    it(`${month}: последняя точка = расходы месяца`, () => {
      const p = paceSeries(input(month));
      expect(p.cumulative).toHaveLength(p.days);
      expect(p.cumulative.at(-1)).toBe(monthReport(input(month)).totalExpense);
      expect(p.cumulative.every((v, i) => i === 0 || v >= p.cumulative[i - 1]!)).toBe(true);
    });
  }

  it('текущий месяц обрывается на сегодня, пунктир сравнивается на эту же дату', () => {
    const p = paceSeries(input('2026-11'));
    expect(p.lastDay).toBe(4);
    expect(p.cumulative).toHaveLength(4);
    expect(p.plan).toBeDefined();
    expect(p.planAtLast).toBe(Math.round((p.plan! * 4) / 30));
    expect(p.diff).toBe(p.cumulative[3]! - p.planAtLast!);
  });

  it('обычный месяц — среднее за 3 предыдущих полных месяца, до сома', () => {
    const p = paceSeries(input('2026-10'));
    const prev = ['2026-07', '2026-08', '2026-09'].map((m) => monthReport(input(m)).totalExpense).filter((v) => v > 0);
    expect(prev.length).toBeGreaterThanOrEqual(2);
    expect(p.plan).toBe(Math.floor(prev.reduce((a, b) => a + b, 0) / prev.length / 100) * 100);
  });

  it('меньше 2 месяцев данных — нет пунктира и пилюли', () => {
    const recent = seed.transactions.filter((t) => t.date >= '2026-09-01');
    const p = paceSeries(input('2026-10', recent));
    expect(p.plan).toBeUndefined();
    expect(p.diff).toBeUndefined();
  });
});

describe('«Итог месяца»', () => {
  for (const month of months) {
    it(`${month}: «Осталось» = доходы − расходы, суммы как в кольце и «Доходах»`, () => {
      const r = monthReport(input(month));
      const s = monthSummary(r, input(month));
      expect(s.expense).toBe(r.totalExpense);
      expect(s.income).toBe(r.totalIncome);
      expect(s.left).toBe(r.totalIncome - r.totalExpense);
      if (s.income) expect(s.spentShare).toBe(Math.floor((s.expense * 100) / s.income));
    });
  }

  it('Δ к прошлому месяцу; для текущего — к тем же числам', () => {
    const c: Category = { id: 'c', name: 'Кафе', kind: 'expense', icon: 'Coffee', color: 'amber', isFixed: false, sortOrder: 0, archived: false };
    const t = (date: string, amount: number): Transaction => ({ id: date + amount, type: 'expense', date, accountId: seed.accounts[0]!.id, amount, categoryId: 'c', createdAt: 0, updatedAt: 0 });
    const base = { today: TODAY, accountById, categoryById: new Map([['c', c]]), recurring: [], rates: new Map(), settings: seed.settings };
    const txs = [t('2026-10-02', 100_000), t('2026-10-20', 900_000), t('2026-11-03', 150_000)];
    const nov = { ...base, month: '2026-11', transactions: txs };
    expect(monthSummary(monthReport(nov), nov).vsPrev).toBe(50); // 1 500 к 1 000 на 4-е, а не к 10 000
    const oct = { ...base, month: '2026-10', transactions: txs };
    expect(monthSummary(monthReport(oct), oct).vsPrev).toBeUndefined(); // в сентябре расходов нет
  });

  it('«больше всего вырос» — от 300 сом к среднему, иначе null; без сравнений — undefined', () => {
    const r = monthReport(input('2026-10'));
    const s = monthSummary(r, input('2026-10'));
    const best = r.byCategory.filter((c) => c.average !== undefined).map((c) => c.total - c.average!).sort((a, b) => b - a)[0]!;
    if (best >= TOP_GROWTH_MIN) expect(s.topGrowth?.amount).toBe(best);
    else expect(s.topGrowth).toBeNull();
    const recent = seed.transactions.filter((t) => t.date >= '2026-10-20');
    const fresh = monthReport(input('2026-11', recent));
    expect(monthSummary(fresh, input('2026-11', recent)).topGrowth).toBeUndefined();
  });
});

describe('«Где сократить»: выгода справа', () => {
  it('рост — «+N», подписки — «N в год», мелкие траты — «N%»', () => {
    const r = monthReport(input('2026-10'));
    for (const i of r.insights) {
      if (i.kind === 'growth') expect(i.gain).toMatch(/^\+[\d ]+$/);
      if (i.kind === 'subscriptions') expect(i.gain).toMatch(/^[\d ]+ в год$/);
      if (i.kind === 'small') expect(i.gain).toMatch(/^\d+%$/);
    }
  });
});
