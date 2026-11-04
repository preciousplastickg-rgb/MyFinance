import { addDays } from './date';
import type { Account, Category, Id, LocalDate, Transaction } from './types';

/**
 * 5 категорий на экране ввода — самые частые за 60 дней, при равенстве по sortOrder (SPEC 4.5).
 * Если частых меньше пяти, добираются по sortOrder.
 */
export function topCategories(
  kind: Category['kind'],
  transactions: readonly Transaction[],
  categories: readonly Category[],
  today: LocalDate,
  limit = 5,
): Category[] {
  const from = addDays(today, -59);
  const counts = new Map<Id, number>();
  for (const t of transactions) {
    if (t.type === kind && t.categoryId && t.date >= from && t.date <= today) {
      counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
    }
  }
  return categories
    .filter((c) => c.kind === kind && !c.archived)
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.sortOrder - b.sortOrder)
    .slice(0, limit);
}

/** Счёт по умолчанию — последний использованный для этого типа операции (SPEC 4.5). */
export function defaultAccount(
  type: Transaction['type'],
  transactions: readonly Transaction[],
  accounts: readonly Account[],
): Account | undefined {
  const active = accounts.filter((a) => !a.archived);
  let last: Transaction | undefined;
  for (const t of transactions) {
    if (t.type === type && (!last || t.createdAt > last.createdAt) && active.some((a) => a.id === t.accountId)) last = t;
  }
  const found = last && active.find((a) => a.id === last.accountId);
  if (found) return found;
  if (type === 'transfer') return active.find((a) => a.currency === 'USDT') ?? active[0];
  return active.find((a) => a.includeInDaily) ?? active[0];
}

/** Для перевода — счёт-получатель последнего перевода с этого счёта (SPEC 4.5). */
export function defaultTransferTarget(
  fromId: Id,
  transactions: readonly Transaction[],
  accounts: readonly Account[],
): Account | undefined {
  const active = accounts.filter((a) => !a.archived && a.id !== fromId);
  let last: Transaction | undefined;
  for (const t of transactions) {
    if (t.type === 'transfer' && t.accountId === fromId && (!last || t.createdAt > last.createdAt)) last = t;
  }
  const from = accounts.find((a) => a.id === fromId);
  return (
    active.find((a) => a.id === last?.toAccountId) ??
    (from?.currency === 'USDT' ? active.find((a) => a.currency === 'KGS' && a.type === 'bank') : undefined) ??
    active[0]
  );
}
