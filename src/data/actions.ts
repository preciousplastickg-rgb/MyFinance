import { db } from '../db';
import { DEFAULT_SETTINGS } from '../db/db';
import { alphabeticalOrder } from '../domain/categories';
import { rateAfterDelete, rateUpdateAfter } from '../domain/rate';
import type { TaskChange } from '../domain/tasks';
import type { Account, Area, Category, Debt, Id, LocalDate, OccurrenceLog, Recurring, Settings, Transaction } from '../domain/types';

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
export async function reorder(table: 'accounts' | 'categories' | 'areas' | 'habits' | 'goals', ids: readonly Id[]): Promise<void> {
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

/** Новая категория встаёт по алфавиту среди своих (этап 29): порядок всех категорий пересчитывается одной транзакцией. */
export async function addCategory(category: Category): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const ids = alphabeticalOrder(await db.categories.toArray(), category);
    await db.categories.put({ ...category, sortOrder: ids.indexOf(category.id) });
    await Promise.all(ids.map((id, i) => (id === category.id ? undefined : db.categories.update(id, { sortOrder: i }))));
  });
}

// ── Регулярные ──────────────────────────────────────────

export async function saveRecurring(recurring: Recurring): Promise<void> {
  await db.recurring.put(recurring);
}

/**
 * Кредит или рассрочка вместе с отметками «оплачен» из календаря (по просьбе пользователя, 4.11). Отмеченный руками —
 * OccurrenceLog(done) без операции: деньги ушли раньше, остатки счетов их уже не содержат. Снятая отметка удаляет такую
 * запись; «пропущено» на отмеченной дате становится «оплачено». Оплаченные кнопкой «Оплачено» (с операцией) не трогаются —
 * их снимают, удалив операцию.
 */
export async function saveLoan(recurring: Recurring, paidDates: readonly LocalDate[]): Promise<void> {
  const want = new Set(paidDates);
  const dates = new Set(recurring.loan?.payments.map((p) => p.date));
  await db.transaction('rw', db.recurring, db.occurrenceLog, async () => {
    await db.recurring.put(recurring);
    const logs = await db.occurrenceLog.where('[recurringId+dueDate]').between([recurring.id, ''], [recurring.id, '\uffff']).toArray();
    const drop = logs.filter((l) => l.status === 'done' && !l.transactionId && dates.has(l.dueDate) && !want.has(l.dueDate));
    if (drop.length) await db.occurrenceLog.bulkDelete(drop.map((l) => l.id));
    const byDate = new Map(logs.map((l) => [l.dueDate, l]));
    const add = [...want]
      .filter((d) => dates.has(d) && byDate.get(d)?.status !== 'done')
      .map((d): OccurrenceLog => ({ id: byDate.get(d)?.id ?? newId(), recurringId: recurring.id, dueDate: d, status: 'done' }));
    if (add.length) await db.occurrenceLog.bulkPut(add);
  });
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
  /** Долг, у которого это была единственная запись (дал / взял в долг): удалён вместе с ней, «Отменить» возвращает. */
  debt?: Debt;
}

/**
 * После удаления операции долга: если у долга не осталось ни операций, ни суммы «без счёта», он пустой — удалить
 * (по замечанию пользователя: удалил запись «дал в долг» в «Деньгах», а долг остался в «Долгах»). Звать внутри
 * rw-транзакции с debts и transactions.
 */
async function removeEmptyDebt(tx: Transaction): Promise<Debt | undefined> {
  if (tx.type !== 'debt' || !tx.debtId) return undefined;
  const debt = await db.debts.get(tx.debtId);
  if (!debt || debt.opening !== 0 || debt.marks?.length) return undefined;
  // По составному индексу [type+date] читаются только операции долгов.
  const moves = await db.transactions.where('[type+date]').between(['debt', ''], ['debt', '\uffff']).filter((t) => t.debtId === debt.id).count();
  if (moves > 0) return undefined;
  await db.debts.delete(debt.id);
  return debt;
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
  return db.transaction('rw', [db.transactions, db.occurrenceLog, db.settings, db.accounts, db.debts], async () => {
    const removed = await removeWithLogs(id);
    if (!removed) return null;
    const debt = await removeEmptyDebt(removed.tx);
    const settings = (await db.settings.get('main')) ?? DEFAULT_SETTINGS;
    let update: Pick<Settings, 'rates'> | null = null;
    if (removed.tx.rate) {
      const accountById = new Map((await db.accounts.toArray()).map((a) => [a.id, a]));
      update = rateAfterDelete(removed.tx, settings, await db.transactions.toArray(), accountById);
      if (update) await db.settings.update('main', update);
    }
    return { ...removed, ratesBefore: settings.rates, ratesChanged: !!update, ...(debt ? { debt } : {}) };
  });
}

export async function restoreTransaction(deleted: DeletedTransaction): Promise<void> {
  await db.transaction('rw', db.transactions, db.occurrenceLog, db.settings, db.debts, async () => {
    if (deleted.debt) await db.debts.put(deleted.debt);
    await db.transactions.put(deleted.tx);
    if (deleted.logs.length) await db.occurrenceLog.bulkPut(deleted.logs);
    if (deleted.ratesChanged) await db.settings.update('main', { rates: deleted.ratesBefore });
  });
}

// ── Наступления регулярных ──────────────────────────────

/** Наступление уже отмечено — сделано или пропущено. Звать внутри rw-транзакции с occurrenceLog. */
async function occurrenceLogged(recurringId: Id, dueDate: string): Promise<boolean> {
  return (await db.occurrenceLog.where('[recurringId+dueDate]').equals([recurringId, dueDate]).count()) > 0;
}

/**
 * «Оплачено» / «Пришло»: операция с ожидаемой (или поправленной) суммой, дата — сегодня,
 * плюс OccurrenceLog(done) с transactionId (SPEC 4.3).
 * Уже отмеченное наступление не пишется второй раз — null. Иначе окно «Зарплата», открытое в 16:59, после
 * автозачисления в 17:00 записало бы доход повторно (две операции на одно наступление).
 */
export async function completeOccurrence(
  recurring: Recurring,
  dueDate: string,
  options: { amount: number; accountId: Id; date: string },
): Promise<Transaction | null> {
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
  return db.transaction('rw', db.transactions, db.occurrenceLog, async () => {
    if (await occurrenceLogged(recurring.id, dueDate)) return null;
    await db.transactions.add(tx);
    await db.occurrenceLog.add({ id: newId(), recurringId: recurring.id, dueDate, status: 'done', transactionId: tx.id });
    return tx;
  });
}

/**
 * Доход в 17:00 сам: операция датой поступления, время записи — 17:00 того дня, отметка auto.
 * Ничего не делает, если наступление уже отмечено или пропущено, счёт в архиве или в другой валюте.
 */
export async function autoCompleteIncome(recurring: Recurring, dueDate: string, at: number): Promise<Transaction | null> {
  return db.transaction('rw', db.transactions, db.occurrenceLog, db.accounts, async () => {
    if (await occurrenceLogged(recurring.id, dueDate)) return null;
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

/**
 * «Пропустить». Уже отмеченное наступление не трогаем — null: доход, зачисленный сам в 17:00, пока было открыто окно,
 * иначе получил бы ещё и «пропущено» (статус берётся по последней записи журнала), а операция осталась бы на счёте.
 */
export async function skipOccurrence(recurringId: Id, dueDate: string): Promise<Id | null> {
  return db.transaction('rw', db.occurrenceLog, async () => {
    if (await occurrenceLogged(recurringId, dueDate)) return null;
    const id = newId();
    await db.occurrenceLog.add({ id, recurringId, dueDate, status: 'skipped' });
    return id;
  });
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
