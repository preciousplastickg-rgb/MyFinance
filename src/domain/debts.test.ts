import { describe, expect, it } from 'vitest';
import { computeBalances } from './balance';
import { debtFlow, debtMoveTitle, debtState, debtsOverview, totalKgs } from './debts';
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
});
