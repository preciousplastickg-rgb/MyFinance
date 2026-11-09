import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { DEFAULT_SETTINGS } from '../db/db';
import type { Account, Transaction } from '../domain/types';
import type { Recurring } from '../domain/types';
import type { Debt } from '../domain/types';
import { deleteTransaction, restoreTransaction, saveLoan, saveTransaction, undoSave } from './actions';
import { addDebtMark, createDebt, makeDebtMemo, removeDebtMark, restoreDebt, restoreDebtMark, saveMemoEntry, undoMemoEntry } from './debts';
import { memoFromEntry } from '../domain/debts';

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

describe('кредит: отметки «оплачен» из календаря (по просьбе пользователя)', () => {
  const loan = (): Recurring => ({
    id: 'loan', kind: 'expense', name: 'Телефон', currency: 'KGS', accountId: 'mbank', categoryId: 'home', isMandatory: true,
    isSubscription: false, active: true, amount: 1_000_000, startDate: '2026-09-04', endDate: '2026-11-04', schedule: { type: 'monthly', day: 4 },
    loan: { kind: 'installment', principal: 3_000_000, termMonths: 3, firstDate: '2026-09-04', payments: [
      { date: '2026-09-04', amount: 1_000_000 }, { date: '2026-10-04', amount: 1_000_000 }, { date: '2026-11-04', amount: 1_000_000 },
    ] },
  });
  const logs = async () => (await db.occurrenceLog.toArray()).map((l) => [l.dueDate, l.status, l.transactionId ?? null]).sort();

  it('отмечает оплаченные без операции, снимает отметку, «пропущено» делает «оплачено», запись с операцией не трогает', async () => {
    await db.occurrenceLog.bulkAdd([
      { id: 'skip', recurringId: 'loan', dueDate: '2026-10-04', status: 'skipped' },
      { id: 'paid', recurringId: 'loan', dueDate: '2026-11-04', status: 'done', transactionId: 'tx' },
    ]);
    await saveLoan(loan(), ['2026-09-04', '2026-10-04']);
    expect(await db.recurring.get('loan')).toMatchObject({ name: 'Телефон' });
    expect(await logs()).toEqual([['2026-09-04', 'done', null], ['2026-10-04', 'done', null], ['2026-11-04', 'done', 'tx']]);
    expect(await db.transactions.count()).toBe(0);

    // Сняли отметку с сентября и с ноября (тот оплачен записью — остаётся).
    await saveLoan(loan(), ['2026-10-04']);
    expect(await logs()).toEqual([['2026-10-04', 'done', null], ['2026-11-04', 'done', 'tx']]);
  });
});

describe('удаление записи долга (по замечанию пользователя)', () => {
  const debt = (id: string, opening = 0): Debt => ({ id, direction: 'owedToMe', person: 'Азамат', currency: 'KGS', opening, date: '2026-11-08', createdAt: 1 });
  const move = (id: string, debtId: string, flow: 'out' | 'in', amount: number): Transaction => ({
    id, type: 'debt', debtId, flow, date: '2026-11-08', accountId: 'mbank', amount, createdAt: 1, updatedAt: 1,
  });

  it('удалили единственную запись «дал в долг» — долг удаляется с ней, «Отменить» возвращает обоих', async () => {
    await db.debts.add(debt('d'));
    await db.transactions.add(move('lend', 'd', 'out', 300_000));
    const deleted = await deleteTransaction('lend');
    expect(deleted?.debt?.id).toBe('d');
    expect(await db.debts.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);
    await restoreTransaction(deleted!);
    expect(await db.debts.get('d')).toMatchObject({ person: 'Азамат' });
    expect(await db.transactions.get('lend')).toMatchObject({ debtId: 'd' });
  });

  it('у долга есть другие записи или сумма «без счёта» — удаляется только запись', async () => {
    await db.debts.bulkAdd([debt('d'), debt('old', 500_000)]);
    await db.transactions.bulkAdd([move('lend', 'd', 'out', 300_000), move('back', 'd', 'in', 100_000), move('paid', 'old', 'in', 200_000)]);
    expect((await deleteTransaction('back'))?.debt).toBeUndefined();
    expect((await deleteTransaction('paid'))?.debt).toBeUndefined();
    expect((await db.debts.toArray()).map((d) => d.id).sort()).toEqual(['d', 'old']);
  });

  it('у долга есть отметки без счёта — удаление его последней записи долг не убирает', async () => {
    await db.debts.add({ ...debt('d'), marks: [{ id: 'k', kind: 'repay', amount: 100_000, date: '2026-11-09', createdAt: 2 }] });
    await db.transactions.add(move('lend', 'd', 'out', 300_000));
    expect((await deleteTransaction('lend'))?.debt).toBeUndefined();
    expect(await db.debts.get('d')).toBeDefined();
  });
});

describe('долг «Только запомнить» (по просьбе пользователя, 2026-11-09)', () => {
  const base = (): Debt => ({ id: 'd', direction: 'iOwe', person: 'Бакыт', currency: 'KGS', opening: 0, date: '2026-11-09', createdAt: 1 });

  it('новая заметка: сумма — начальная, ни одной операции по счетам', async () => {
    await createDebt({ ...base(), memo: true }, 500_000);
    expect(await db.debts.get('d')).toMatchObject({ memo: true, opening: 500_000 });
    expect(await db.transactions.count()).toBe(0);
  });

  it('«Вернул» без счёта — отметка в долге; удалить её и «Отменить» возвращает ту же', async () => {
    await createDebt({ ...base(), memo: true }, 500_000);
    const mark = await addDebtMark(base(), 'repay', { amount: 200_000, date: '2026-11-10' });
    expect((await db.debts.get('d'))?.marks).toEqual([mark]);
    expect(await db.transactions.count()).toBe(0);
    const removed = await removeDebtMark('d', mark.id);
    expect(removed).toEqual(mark);
    expect((await db.debts.get('d'))?.marks).toBeUndefined();
    await restoreDebtMark('d', removed!);
    await restoreDebtMark('d', removed!); // повторное «Отменить» не задваивает
    expect((await db.debts.get('d'))?.marks).toEqual([mark]);
  });

  it('из новой записи: новый долг-заметка или отметка у открытого — без операций; «Отменить» убирает', async () => {
    const fresh = memoFromEntry({ kind: 'grow', direction: 'iOwe', person: 'Азамат' }, { amount: 500_000, currency: 'KGS', date: '2026-11-09' }, 1, () => crypto.randomUUID());
    await saveMemoEntry(fresh);
    expect(await db.debts.get(fresh.newDebt!.id)).toMatchObject({ memo: true, opening: 500_000 });
    const back = memoFromEntry({ kind: 'repay', direction: 'iOwe', debtId: fresh.newDebt!.id }, { amount: 200_000, currency: 'KGS', date: '2026-11-10' }, 2, () => crypto.randomUUID());
    await saveMemoEntry(back);
    expect((await db.debts.get(fresh.newDebt!.id))?.marks).toEqual([back.mark!.mark]);
    expect(await db.transactions.count()).toBe(0);
    await undoMemoEntry(back);
    expect((await db.debts.get(fresh.newDebt!.id))?.marks).toBeUndefined();
    await undoMemoEntry(fresh);
    expect(await db.debts.count()).toBe(0);
    await expect(saveMemoEntry(back)).rejects.toThrow('долг не найден');
  });

  it('долг, записанный на MBank, сделать заметкой: операция уходит, сумма — начальная; «Отменить» возвращает как было', async () => {
    await createDebt(base(), 500_000, 'mbank');
    const [tx] = await db.transactions.toArray();
    expect(tx).toMatchObject({ type: 'debt', flow: 'in', amount: 500_000 });
    const before = await makeDebtMemo(base(), 500_000, tx);
    expect(await db.transactions.count()).toBe(0);
    expect(await db.debts.get('d')).toMatchObject({ memo: true, opening: 500_000 });
    await restoreDebt(before);
    expect(await db.transactions.get(tx!.id)).toMatchObject({ amount: 500_000 });
    const back = await db.debts.get('d');
    expect(back?.memo).toBeUndefined();
    expect(back?.opening).toBe(0);
  });
});
