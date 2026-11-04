import { db } from '../db';
import type { Account, Category, Id, OccurrenceLog, Recurring, Settings, Transaction } from '../domain/types';

export const newId = (): Id => crypto.randomUUID();

export async function updateSettings(patch: Partial<Omit<Settings, 'key'>>): Promise<void> {
  await db.settings.update('main', patch);
}

// ── Счета ───────────────────────────────────────────────

export async function saveAccount(account: Account): Promise<void> {
  await db.accounts.put(account);
}

export async function nextSortOrder(table: 'accounts' | 'categories' | 'areas'): Promise<number> {
  const last = await db.table(table).orderBy('sortOrder').last();
  return last ? (last as { sortOrder: number }).sortOrder + 1 : 0;
}

/** Порядок после перетаскивания: sortOrder = позиция в списке. */
export async function reorder(table: 'accounts' | 'categories' | 'areas', ids: readonly Id[]): Promise<void> {
  await db.transaction('rw', db.table(table), async () => {
    await Promise.all(ids.map((id, i) => db.table(table).update(id, { sortOrder: i })));
  });
}

export async function setArchived(table: 'accounts' | 'categories' | 'areas', id: Id, archived: boolean): Promise<void> {
  await db.table(table).update(id, { archived });
}

export async function accountHasTransactions(id: Id): Promise<boolean> {
  return (await db.transactions.where('accountId').equals(id).count()) > 0
    || (await db.transactions.where('toAccountId').equals(id).count()) > 0;
}

// ── Категории ───────────────────────────────────────────

export async function saveCategory(category: Category): Promise<void> {
  await db.categories.put(category);
}

// ── Регулярные ──────────────────────────────────────────

export async function saveRecurring(recurring: Recurring): Promise<void> {
  await db.recurring.put(recurring);
}

// ── Первый запуск ───────────────────────────────────────

export async function completeOnboarding(accounts: Account[], recurring: Recurring[]): Promise<void> {
  await db.transaction('rw', db.accounts, db.recurring, db.settings, async () => {
    if ((await db.accounts.count()) === 0) await db.accounts.bulkAdd(accounts);
    if (recurring.length) await db.recurring.bulkAdd(recurring);
    await db.settings.update('main', { onboardingDone: true });
  });
}

// ── Операции ────────────────────────────────────────────


export async function addTransaction(tx: Transaction): Promise<void> {
  await db.transactions.add(tx);
}

export async function updateTransaction(tx: Transaction): Promise<void> {
  await db.transactions.put({ ...tx, updatedAt: Date.now() });
}

export interface DeletedTransaction {
  tx: Transaction;
  logs: OccurrenceLog[];
}

/** Удаление с возможностью отмены: если операция закрывала регулярный платёж, отметка тоже снимается. */
export async function deleteTransaction(id: Id): Promise<DeletedTransaction | null> {
  return db.transaction('rw', db.transactions, db.occurrenceLog, async () => {
    const tx = await db.transactions.get(id);
    if (!tx) return null;
    const logs = tx.recurringId
      ? (await db.occurrenceLog.where('[recurringId+dueDate]').equals([tx.recurringId, tx.dueDate ?? '']).toArray()).filter(
          (l) => l.transactionId === id,
        )
      : [];
    await db.transactions.delete(id);
    await db.occurrenceLog.bulkDelete(logs.map((l) => l.id));
    return { tx, logs };
  });
}

export async function restoreTransaction(deleted: DeletedTransaction): Promise<void> {
  await db.transaction('rw', db.transactions, db.occurrenceLog, async () => {
    await db.transactions.put(deleted.tx);
    if (deleted.logs.length) await db.occurrenceLog.bulkPut(deleted.logs);
  });
}

// ── Наступления регулярных ──────────────────────────────

/**
 * «Оплачено» / «Пришло»: операция с ожидаемой (или поправленной) суммой, дата — сегодня,
 * плюс OccurrenceLog(done) с transactionId (SPEC 4.3).
 */
export async function completeOccurrence(
  recurring: Recurring,
  dueDate: string,
  options: { amount: number; accountId: Id; date: string },
): Promise<Transaction> {
  const now = Date.now();
  const tx: Transaction = {
    id: newId(),
    type: recurring.kind,
    date: options.date,
    accountId: options.accountId,
    amount: options.amount,
    categoryId: recurring.categoryId,
    note: recurring.name,
    recurringId: recurring.id,
    dueDate,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction('rw', db.transactions, db.occurrenceLog, async () => {
    await db.transactions.add(tx);
    await db.occurrenceLog.add({ id: newId(), recurringId: recurring.id, dueDate, status: 'done', transactionId: tx.id });
  });
  return tx;
}

export async function skipOccurrence(recurringId: Id, dueDate: string): Promise<void> {
  await db.occurrenceLog.add({ id: newId(), recurringId, dueDate, status: 'skipped' });
}
