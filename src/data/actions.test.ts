import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { DEFAULT_SETTINGS } from '../db/db';
import type { Account, Transaction } from '../domain/types';
import { deleteTransaction, restoreTransaction, saveTransaction, undoSave } from './actions';

const account = (id: string, currency: string): Account => ({
  id, name: id, type: currency === 'KGS' ? 'bank' : 'crypto', currency, icon: 'Landmark', color: '#2448D6',
  includeInDaily: currency === 'KGS', openingBalance: 0, openingDate: '2026-11-01', sortOrder: 0, archived: false,
});

let n = 0;
/** Обмен USDT → MBank по курсу rate (×10 000), дата date. */
const exchange = (rate: number, date: string): Transaction => ({
  id: `t${n++}`, type: 'transfer', date, accountId: 'usdt', amount: 10_000, toAccountId: 'mbank', toAmount: rate / 100, rate,
  createdAt: n, updatedAt: n,
});

const usdtRate = async () => (await db.settings.get('main'))?.rates?.USDT;

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ ...DEFAULT_SETTINGS, rates: { USDT: { rate: 860_000, date: '2026-10-01' } } });
  await db.accounts.bulkPut([account('mbank', 'KGS'), account('usdt', 'USDT')]);
});

describe('операции и курс', () => {
  it('сохранение обмена пишет операцию и курс вместе', async () => {
    await saveTransaction(exchange(875_000, '2026-11-02'), true);
    expect(await db.transactions.count()).toBe(1);
    expect(await usdtRate()).toEqual({ rate: 875_000, date: '2026-11-02' });
  });

  it('«Отменить» после обмена возвращает прежний курс', async () => {
    const saved = await saveTransaction(exchange(875_000, '2026-11-02'), true);
    await undoSave(saved);
    expect(await db.transactions.count()).toBe(0);
    expect(await usdtRate()).toEqual({ rate: 860_000, date: '2026-10-01' });
  });

  it('удаление обмена, давшего курс: курсом становится предыдущий обмен; восстановление — обратно', async () => {
    await saveTransaction(exchange(870_000, '2026-11-01'), true);
    const last = exchange(880_000, '2026-11-03');
    await saveTransaction(last, true);
    const deleted = await deleteTransaction(last.id);
    expect(await usdtRate()).toEqual({ rate: 870_000, date: '2026-11-01' });
    await restoreTransaction(deleted!);
    expect(await usdtRate()).toEqual({ rate: 880_000, date: '2026-11-03' });
    expect(await db.transactions.count()).toBe(2);
  });

  it('повторное добавление с тем же id падает целиком — курс не меняется', async () => {
    const tx = exchange(875_000, '2026-11-02');
    await saveTransaction(tx, true);
    await expect(saveTransaction({ ...tx, rate: 900_000, date: '2026-11-04' }, true)).rejects.toThrow();
    expect(await usdtRate()).toEqual({ rate: 875_000, date: '2026-11-02' });
  });
});
