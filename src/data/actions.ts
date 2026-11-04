import { db } from '../db';
import type { Account, Category, Id, Recurring, Settings } from '../domain/types';

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
