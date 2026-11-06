import { db } from '../db';
import { debtFlow, type DebtMoveKind } from '../domain/debts';
import type { Debt, Id, LocalDate, Minor, Transaction } from '../domain/types';

const newId = () => crypto.randomUUID();

function moveTx(debt: Debt, kind: DebtMoveKind, money: { accountId: Id; amount: Minor; date: LocalDate }): Transaction {
  const now = Date.now();
  return {
    id: newId(),
    type: 'debt',
    debtId: debt.id,
    flow: debtFlow(debt.direction, kind),
    date: money.date,
    accountId: money.accountId,
    amount: money.amount,
    note: debt.person,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Новый долг. Со счётом — деньги проходят по нему (дал в долг — ушли, взял — пришли);
 * без счёта — сумма становится начальной (долг был до приложения или деньги не с учётных счетов).
 */
export async function createDebt(debt: Debt, amount: Minor, accountId?: Id): Promise<void> {
  await db.transaction('rw', db.debts, db.transactions, async () => {
    await db.debts.add({ ...debt, opening: accountId ? 0 : amount });
    if (accountId) await db.transactions.add(moveTx(debt, 'grow', { accountId, amount, date: debt.date }));
  });
}

export async function saveDebt(debt: Debt): Promise<void> {
  await db.debts.put(debt);
}

/** «Вернули» / «Вернул» (repay) или «Дал ещё» / «Взял ещё» (grow) — операция по счёту. */
export async function addDebtMove(debt: Debt, kind: DebtMoveKind, money: { accountId: Id; amount: Minor; date: LocalDate }): Promise<Transaction> {
  const tx = moveTx(debt, kind, money);
  await db.transactions.add(tx);
  return tx;
}

/** Закрыть без денег (простить, списать) или открыть снова. */
export async function setDebtClosed(id: Id, closed: boolean): Promise<void> {
  await db.debts.update(id, { closedAt: closed ? Date.now() : undefined });
}

export interface DeletedDebt {
  debt: Debt;
  moves: Transaction[];
}

/** Удалить долг вместе с его операциями: балансы счетов возвращаются. «Отменить» — restoreDebt. */
export async function deleteDebt(id: Id): Promise<DeletedDebt | null> {
  return db.transaction('rw', db.debts, db.transactions, async () => {
    const debt = await db.debts.get(id);
    if (!debt) return null;
    const moves = await db.transactions.filter((t) => t.type === 'debt' && t.debtId === id).toArray();
    await db.transactions.bulkDelete(moves.map((t) => t.id));
    await db.debts.delete(id);
    return { debt, moves };
  });
}

export async function restoreDebt(deleted: DeletedDebt): Promise<void> {
  await db.transaction('rw', db.debts, db.transactions, async () => {
    await db.debts.put(deleted.debt);
    if (deleted.moves.length) await db.transactions.bulkPut(deleted.moves);
  });
}
