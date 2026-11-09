import { describe, expect, it } from 'vitest';
import { computeBalances } from './balance';
import { canMakeMemo, debtDirectionFor, debtFlow, debtMoveTitle, debtState, debtsOverview, isDebtCategory, totalKgs, openingMove } from './debts';
import { groupByDay, monthTotals } from './history';
import { rateBook } from './rate';
import type { Account, Debt, Transaction } from './types';

const TODAY = '2026-11-06';
const debt = (id: string, extra: Partial<Debt> = {}): Debt => ({
  id, direction: 'owedToMe', person: id, currency: 'KGS', opening: 0, date: '2026-11-01', createdAt: 1, ...extra,
});
let n = 0;
const move = (debtId: string, flow: 'out' | 'in', amount: number, date = '2026-11-02'): Transaction => ({
  id: `m${n++}`, type: 'debt', debtId, flow, date, accountId: 'mbank', amount, createdAt: n, updatedAt: n,
});
const mbank: Account = {
  id: 'mbank', name: 'MBank', type: 'bank', currency: 'KGS', icon: 'Landmark', color: '#2448D6', includeInDaily: true,
  openingBalance: 2_000_000, openingDate: '2026-11-01', sortOrder: 0, archived: false,
};

describe('долги', () => {
  it('куда идут деньги и как подписать', () => {
    expect(debtFlow('owedToMe', 'grow')).toBe('out');
    expect(debtFlow('owedToMe', 'repay')).toBe('in');
    expect(debtFlow('iOwe', 'grow')).toBe('in');
    expect(debtFlow('iOwe', 'repay')).toBe('out');
    expect(debtMoveTitle('owedToMe', 'out')).toBe('Дал в долг');
    expect(debtMoveTitle('owedToMe', 'in')).toBe('Вернули долг');
    expect(debtMoveTitle('iOwe', 'in')).toBe('Взял в долг');
    expect(debtMoveTitle('iOwe', 'out')).toBe('Вернул долг');
  });

  it('дал 5 000, вернули 2 000 — должны ещё 3 000; деньги прошли по счёту, но не доход и не расход', () => {
    const txs = [move('azamat', 'out', 500_000), move('azamat', 'in', 200_000, '2026-11-05')];
    const s = debtState(debt('azamat'), txs, TODAY);
    expect([s.total, s.repaid, s.remaining, s.closed]).toEqual([500_000, 200_000, 300_000, false]);
    expect(s.moves.map((m) => m.flow)).toEqual(['in', 'out']); // новые сверху
    expect(computeBalances([mbank], txs).get('mbank')).toBe(1_700_000);
    const accounts = new Map([['mbank', mbank]]);
    expect(monthTotals(txs, accounts, rateBook([], accounts))).toMatchObject({ income: 0, expense: 0 });
    expect(groupByDay(txs, accounts, rateBook([], accounts)).map((g) => g.total)).toEqual([0, 0]);
  });

  it('долг без счёта: начальная сумма; погашен полностью или закрыт вручную — в закрытых', () => {
    const old = debt('old', { direction: 'iOwe', opening: 1_000_000, dueDate: '2026-11-05' });
    expect(debtState(old, [], TODAY)).toMatchObject({ remaining: 1_000_000, overdue: true, closed: false });
    expect(debtState(old, [move('old', 'out', 1_000_000)], TODAY)).toMatchObject({ remaining: 0, closed: true, overdue: false });
    expect(debtState({ ...old, closedAt: 5 }, [], TODAY)).toMatchObject({ remaining: 1_000_000, closed: true });
  });

  it('обзор: просроченные и с ближним сроком сверху, итоги по валютам', () => {
    const debts = [
      debt('later', { opening: 100_000, dueDate: '2026-12-01' }),
      debt('nodue', { opening: 200_000 }),
      debt('overdue', { opening: 300_000, dueDate: '2026-11-01' }),
      debt('usd', { opening: 5_000, currency: 'USD' }),
      debt('mine', { direction: 'iOwe', opening: 400_000 }),
      debt('done', { opening: 100_000, closedAt: 1 }),
    ];
    const o = debtsOverview(debts, [], TODAY);
    expect(o.owedToMe.map((s) => s.debt.id)).toEqual(['overdue', 'later', 'nodue', 'usd']);
    expect(o.iOwe.map((s) => s.debt.id)).toEqual(['mine']);
    expect(o.closed.map((s) => s.debt.id)).toEqual(['done']);
    expect(o.totals.owedToMe.get('KGS')).toBe(600_000);
    expect(totalKgs(o.totals.owedToMe, (c) => (c === 'USD' ? 875_000 : undefined))).toBe(600_000 + 437_500);
  });

  it('пустой долг — без суммы «без счёта» и без операций (его запись удалили) — не показывается ни в открытых, ни в закрытых', () => {
    const o = debtsOverview([debt('empty'), debt('lent'), debt('old', { opening: 100_000 })], [move('lent', 'out', 300_000)], TODAY);
    expect(o.owedToMe.map((s) => s.debt.id)).toEqual(['lent', 'old']);
    expect(o.closed).toEqual([]);
  });
});

describe('долг «Только запомнить» (по просьбе пользователя, 2026-11-09)', () => {
  const mark = (id: string, kind: 'grow' | 'repay', amount: number, date = '2026-11-03') => ({ id, kind, amount, date, createdAt: 1 });

  it('остаток — начальная сумма плюс «взял ещё» минус возвраты без счёта; счета не меняются', () => {
    const memo = debt('rent', { direction: 'iOwe', memo: true, opening: 1_200_000, marks: [mark('a', 'repay', 200_000), mark('b', 'grow', 50_000, '2026-11-04')] });
    const s = debtState(memo, [], TODAY);
    expect([s.total, s.repaid, s.remaining, s.closed]).toEqual([1_250_000, 200_000, 1_050_000, false]);
    expect(s.marks.map((m) => m.id)).toEqual(['b', 'a']); // новые сверху
    expect(debtState({ ...memo, marks: [mark('all', 'repay', 1_200_000)] }, [], TODAY)).toMatchObject({ remaining: 0, closed: true });
  });

  it('в «Долгах» и их итогах заметка есть, в итогах для «Остатка» — нет', () => {
    const o = debtsOverview(
      [debt('memo', { direction: 'iOwe', memo: true, opening: 500_000 }), debt('real', { direction: 'iOwe', opening: 300_000 }), debt('lent', { memo: true, opening: 100_000 })],
      [],
      TODAY,
    );
    expect(o.iOwe.map((s) => s.debt.id).sort()).toEqual(['memo', 'real']);
    expect(o.totals.iOwe.get('KGS')).toBe(800_000);
    expect(o.moneyTotals.iOwe.get('KGS')).toBe(300_000);
    expect(o.totals.owedToMe.get('KGS')).toBe(100_000);
    expect(o.moneyTotals.owedToMe.size).toBe(0);
  });

  it('долг только с отметками (без начальной суммы и операций) не считается пустым', () => {
    const o = debtsOverview([debt('m', { memo: true, marks: [mark('g', 'grow', 100_000)] })], [], TODAY);
    expect(o.owedToMe.map((s) => s.remaining)).toEqual([100_000]);
  });

  it('сделать заметкой можно, пока по долгу нет денег, кроме первой операции', () => {
    const lent = move('x', 'out', 500_000);
    expect(canMakeMemo(debt('x'), [lent])).toBe(true);
    expect(canMakeMemo(debt('old', { opening: 100_000 }), [])).toBe(true);
    expect(canMakeMemo(debt('x'), [lent, move('x', 'in', 100_000, '2026-11-05')])).toBe(false);
    expect(canMakeMemo(debt('x', { memo: true, opening: 100_000 }), [])).toBe(false);
    expect(canMakeMemo(debt('x', { opening: 100_000, marks: [mark('k', 'repay', 1)] }), [])).toBe(false);
  });
});

describe('сумма долга', () => {
  it('openingMove — самая ранняя операция «дал / взял», возвраты не считаются; без счёта — нет', () => {
    const debt = { id: 'd', direction: 'owedToMe' as const, person: 'А', currency: 'KGS', opening: 0, date: '2026-11-01', createdAt: 1 };
    const tx = (id: string, flow: 'out' | 'in', date: string, createdAt: number) => ({
      id, type: 'debt' as const, debtId: 'd', flow, date, accountId: 'm', amount: 100, createdAt, updatedAt: createdAt,
    });
    expect(openingMove(debt, [tx('repay', 'in', '2026-10-01', 1), tx('later', 'out', '2026-11-05', 2), tx('first', 'out', '2026-11-01', 3)])?.id).toBe('first');
    expect(openingMove({ ...debt, opening: 5000 }, [])).toBeUndefined();
  });
});

describe('категория «Долг» в записи', () => {
  it('узнаётся по названию', () => {
    expect(isDebtCategory({ name: 'Долг' })).toBe(true);
    expect(isDebtCategory({ name: 'долги друзьям' })).toBe(true);
    expect(isDebtCategory({ name: 'Займ' })).toBe(true);
    expect(isDebtCategory({ name: 'Кафе' })).toBe(false);
    expect(isDebtCategory(undefined)).toBe(false);
  });
  it('расход — дал в долг или вернул; доход — взял в долг или мне вернули; деньги идут как у записи', () => {
    expect(debtDirectionFor('expense', 'grow')).toBe('owedToMe');
    expect(debtDirectionFor('expense', 'repay')).toBe('iOwe');
    expect(debtDirectionFor('income', 'grow')).toBe('iOwe');
    expect(debtDirectionFor('income', 'repay')).toBe('owedToMe');
    for (const type of ['expense', 'income'] as const) {
      for (const kind of ['grow', 'repay'] as const) {
        expect(debtFlow(debtDirectionFor(type, kind), kind)).toBe(type === 'expense' ? 'out' : 'in');
      }
    }
  });
});
