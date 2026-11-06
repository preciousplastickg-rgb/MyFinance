import { db } from '../db';
import { DEFAULT_SETTINGS } from '../db/db';
import { rateAfterDelete, rateUpdateAfter } from '../domain/rate';
import type { TaskChange } from '../domain/tasks';
import type { Account, Area, Category, Debt, Id, OccurrenceLog, Recurring, Settings, Transaction } from '../domain/types';

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
export async function reorder(table: 'accounts' | 'categories' | 'areas' | 'habits', ids: readonly Id[]): Promise<void> {
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

/** «Удалить» регулярный: скрывается, прошлые операции и отметки остаются. */
export async function deleteRecurring(id: Id): Promise<void> {
  await db.recurring.update(id, { deletedAt: Date.now() });
}

export async function restoreRecurring(id: Id): Promise<void> {
  await db.recurring.update(id, { deletedAt: undefined });
}

export async function completeOnboarding(accounts: Account[], recurring: Recurring[]): Promise<void> {
  await db.transaction('rw', db.accounts, db.recurring, db.settings, async () => {
    if ((await db.accounts.count()) === 0) await db.accounts.bulkAdd(accounts);
    if (recurring.length) await db.recurring.bulkAdd(recurring);
    await db.settings.update('main', { onboardingDone: true });
  });
}

// ── Операции ────────────────────────────────────────────

export interface SavedTransaction {
  tx: Transaction;
  /** Курсы до сохранения — если обмен их поменял (для «Отменить»). */
  ratesBefore?: Settings['rates'];
  ratesChanged: boolean;
  /** Долг, открытый этой записью: «Отменить» убирает и его. */
  createdDebtId?: Id;
}

/**
 * Новая или поправленная операция и курс валюты после обмена — одной транзакцией Dexie (SPEC 4.2):
 * либо записано всё, либо ничего.
 */
export async function saveTransaction(
  tx: Transaction,
  isNew: boolean,
  newDebt?: Debt,
  /** Обычная трата засчитана как оплата регулярного платежа: запись получает recurringId, наступление — отметку done. */
  occurrence?: { recurringId: Id; dueDate: string },
): Promise<SavedTransaction> {
  return db.transaction('rw', db.transactions, db.settings, db.accounts, db.debts, db.occurrenceLog, async () => {
    // Запись с категорией «Долг» может открыть новый долг — вместе с операцией (этап 19).
    if (newDebt) await db.debts.add(newDebt);
    if (occurrence) {
      tx = { ...tx, recurringId: occurrence.recurringId, dueDate: occurrence.dueDate };
      await db.occurrenceLog.add({ id: newId(), recurringId: occurrence.recurringId, dueDate: occurrence.dueDate, status: 'done', transactionId: tx.id });
    }
    if (isNew) await db.transactions.add(tx);
    else await db.transactions.put({ ...tx, updatedAt: Date.now() });
    const settings = (await db.settings.get('main')) ?? DEFAULT_SETTINGS;
    const accountById = new Map((await db.accounts.toArray()).map((a) => [a.id, a]));
    const update = rateUpdateAfter(tx, settings, accountById);
    if (update) await db.settings.update('main', update);
    return { tx, ratesBefore: settings.rates, ratesChanged: !!update, ...(newDebt ? { createdDebtId: newDebt.id } : {}) };
  });
}

/** «Отменить» сразу после сохранения новой операции: убрать её и вернуть прежний курс. */
export async function undoSave(saved: SavedTransaction): Promise<void> {
  await db.transaction('rw', db.transactions, db.occurrenceLog, db.settings, db.debts, async () => {
    await removeWithLogs(saved.tx.id);
    if (saved.ratesChanged) await db.settings.update('main', { rates: saved.ratesBefore });
    if (saved.createdDebtId) await db.debts.delete(saved.createdDebtId);
  });
}

export interface DeletedTransaction {
  tx: Transaction;
  logs: OccurrenceLog[];
  ratesBefore?: Settings['rates'];
  ratesChanged: boolean;
}

async function removeWithLogs(id: Id): Promise<{ tx: Transaction; logs: OccurrenceLog[] } | null> {
  const tx = await db.transactions.get(id);
  if (!tx) return null;
  const logs = tx.recurringId
    ? (await db.occurrenceLog.where('[recurringId+dueDate]').equals([tx.recurringId, tx.dueDate ?? '']).toArray()).filter(
        (l) => l.transactionId === id,
      )
    : [];
  await db.transactions.delete(id);
  // Автозачисление после удаления операции — «пропущено», иначе в 17:00 оно записалось бы снова.
  await db.occurrenceLog.bulkDelete(logs.filter((l) => !l.auto).map((l) => l.id));
  const auto = logs.filter((l) => l.auto);
  if (auto.length) await db.occurrenceLog.bulkPut(auto.map(({ transactionId: _t, ...l }) => ({ ...l, status: 'skipped' as const })));
  return { tx, logs };
}

/**
 * Удаление с возможностью отмены: если операция закрывала регулярный платёж, отметка тоже снимается;
 * если курс валюты взят из этого обмена — курсом становится предыдущий обмен.
 */
export async function deleteTransaction(id: Id): Promise<DeletedTransaction | null> {
  return db.transaction('rw', [db.transactions, db.occurrenceLog, db.settings, db.accounts], async () => {
    const removed = await removeWithLogs(id);
    if (!removed) return null;
    const settings = (await db.settings.get('main')) ?? DEFAULT_SETTINGS;
    let update: Pick<Settings, 'rates'> | null = null;
    if (removed.tx.rate) {
      const accountById = new Map((await db.accounts.toArray()).map((a) => [a.id, a]));
      update = rateAfterDelete(removed.tx, settings, await db.transactions.toArray(), accountById);
      if (update) await db.settings.update('main', update);
    }
    return { ...removed, ratesBefore: settings.rates, ratesChanged: !!update };
  });
}

export async function restoreTransaction(deleted: DeletedTransaction): Promise<void> {
  await db.transaction('rw', db.transactions, db.occurrenceLog, db.settings, async () => {
    await db.transactions.put(deleted.tx);
    if (deleted.logs.length) await db.occurrenceLog.bulkPut(deleted.logs);
    if (deleted.ratesChanged) await db.settings.update('main', { rates: deleted.ratesBefore });
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

/**
 * Доход в 17:00 сам: операция датой поступления, время записи — 17:00 того дня, отметка auto.
 * Ничего не делает, если наступление уже отмечено или пропущено, счёт в архиве или в другой валюте.
 */
export async function autoCompleteIncome(recurring: Recurring, dueDate: string, at: number): Promise<Transaction | null> {
  return db.transaction('rw', db.transactions, db.occurrenceLog, db.accounts, async () => {
    if ((await db.occurrenceLog.where('[recurringId+dueDate]').equals([recurring.id, dueDate]).count()) > 0) return null;
    const account = await db.accounts.get(recurring.accountId);
    if (!account || account.archived || account.currency !== recurring.currency) return null;
    const tx: Transaction = {
      id: newId(),
      type: 'income',
      date: dueDate,
      accountId: account.id,
      amount: recurring.amount,
      categoryId: recurring.categoryId,
      note: recurring.name,
      recurringId: recurring.id,
      dueDate,
      createdAt: at,
      updatedAt: at,
    };
    await db.transactions.add(tx);
    await db.occurrenceLog.add({ id: newId(), recurringId: recurring.id, dueDate, status: 'done', transactionId: tx.id, auto: true });
    return tx;
  });
}

export async function skipOccurrence(recurringId: Id, dueDate: string): Promise<Id> {
  const id = newId();
  await db.occurrenceLog.add({ id, recurringId, dueDate, status: 'skipped' });
  return id;
}

/** «Отменить» после «Пропустить»: наступление снова ждёт отметки. */
export async function unskipOccurrence(logId: Id): Promise<void> {
  await db.occurrenceLog.delete(logId);
}

// ── Дела ────────────────────────────────────────────────

/** Задача и события журнала пишутся вместе. */
export async function applyTaskChange(change: TaskChange): Promise<void> {
  await db.transaction('rw', db.tasks, db.taskEvents, async () => {
    await db.tasks.put(change.task);
    if (change.events.length) await db.taskEvents.bulkAdd(change.events);
  });
}

export async function saveArea(area: Area): Promise<void> {
  await db.areas.put(area);
}
