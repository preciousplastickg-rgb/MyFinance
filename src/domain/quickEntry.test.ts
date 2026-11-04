import { describe, expect, it } from 'vitest';
import { defaultAccount, defaultTransferTarget, topCategories } from './quickEntry';
import type { Account, Category, Transaction } from './types';

const cat = (id: string, sortOrder: number, kind: Category['kind'] = 'expense'): Category => ({
  id, name: id, kind, icon: 'Star', color: '#2448D6', isFixed: false, sortOrder, archived: false,
});
const acc = (id: string, currency: Account['currency'] = 'KGS', extra: Partial<Account> = {}): Account => ({
  id, name: id, type: 'bank', currency, icon: 'Landmark', color: '#2448D6', includeInDaily: currency === 'KGS',
  openingBalance: 0, openingDate: '2026-01-01', sortOrder: 0, archived: false, ...extra,
});
let n = 0;
const tx = (t: Partial<Transaction>): Transaction => ({
  id: `t${n++}`, type: 'expense', date: '2026-11-01', accountId: 'a', amount: 100, createdAt: n, updatedAt: n, ...t,
});

describe('topCategories', () => {
  const cats = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, i) => cat(id, i));
  it('частые за 60 дней, при равенстве — по sortOrder', () => {
    const txs = [
      tx({ categoryId: 'g' }), tx({ categoryId: 'g' }), tx({ categoryId: 'f' }), tx({ categoryId: 'e' }),
      tx({ categoryId: 'b', date: '2026-08-01' }), // старше 60 дней — не считается
    ];
    expect(topCategories('expense', txs, cats, '2026-11-04').map((c) => c.id)).toEqual(['g', 'e', 'f', 'a', 'b']);
  });
  it('окно 60 дней включает сегодня и 59 дней назад', () => {
    const txs = [tx({ categoryId: 'g', date: '2026-09-06' }), tx({ categoryId: 'f', date: '2026-09-05' })];
    expect(topCategories('expense', txs, cats, '2026-11-04')[0]!.id).toBe('g');
  });
  it('без архивных и чужого типа', () => {
    const list = [cat('x', 0, 'income'), { ...cat('y', 1), archived: true }, cat('z', 2)];
    expect(topCategories('expense', [], list, '2026-11-04').map((c) => c.id)).toEqual(['z']);
  });
});

describe('defaultAccount', () => {
  const accounts = [acc('usdt', 'USDT'), acc('mbank'), acc('cash')];
  it('последний использованный для типа операции', () => {
    const txs = [tx({ accountId: 'mbank', createdAt: 1 }), tx({ accountId: 'cash', createdAt: 5 }), tx({ type: 'income', accountId: 'usdt', createdAt: 9 })];
    expect(defaultAccount('expense', txs, accounts)?.id).toBe('cash');
    expect(defaultAccount('income', txs, accounts)?.id).toBe('usdt');
  });
  it('без истории — первый счёт из лимита на день', () => {
    expect(defaultAccount('expense', [], accounts)?.id).toBe('mbank');
  });
  it('архивный счёт не подставляется', () => {
    const txs = [tx({ accountId: 'cash' })];
    expect(defaultAccount('expense', txs, [acc('cash', 'KGS', { archived: true }), acc('mbank')])?.id).toBe('mbank');
  });
});

describe('defaultTransferTarget', () => {
  const accounts = [acc('usdt', 'USDT'), acc('mbank'), acc('optima')];
  it('получатель последнего перевода с этого счёта', () => {
    const txs = [
      tx({ type: 'transfer', accountId: 'usdt', toAccountId: 'mbank', createdAt: 1 }),
      tx({ type: 'transfer', accountId: 'usdt', toAccountId: 'optima', createdAt: 2 }),
    ];
    expect(defaultTransferTarget('usdt', txs, accounts)?.id).toBe('optima');
  });
  it('из USDT без истории — первый сомовый банк', () => {
    expect(defaultTransferTarget('usdt', [], accounts)?.id).toBe('mbank');
  });
});
