import { usdtToKgs } from './rate';
import type { Account, Id, Minor, Transaction } from './types';

/**
 * Баланс = начальный остаток + доходы − расходы − исходящие переводы + входящие переводы (SPEC 4.1).
 * Балансы не хранятся, всегда считаются из операций.
 */
export function computeBalances(accounts: readonly Account[], transactions: readonly Transaction[]): Map<Id, Minor> {
  const balances = new Map<Id, Minor>();
  for (const a of accounts) balances.set(a.id, a.openingBalance);
  const add = (id: Id, delta: Minor) => {
    const current = balances.get(id);
    if (current !== undefined) balances.set(id, current + delta);
  };
  for (const t of transactions) {
    if (t.type === 'income') add(t.accountId, t.amount);
    else if (t.type === 'expense') add(t.accountId, -t.amount);
    else {
      add(t.accountId, -t.amount);
      if (t.toAccountId) add(t.toAccountId, t.toAmount ?? t.amount);
    }
  }
  return balances;
}

/**
 * «Всего ≈ N сом»: сомовые счета + USDT по последнему курсу (SPEC 4.2).
 * Нет курса — USDT не учитывается и approx = false только если USDT-счетов нет.
 */
export function totalInKgs(
  accounts: readonly Account[],
  balances: ReadonlyMap<Id, Minor>,
  usdtRate: number | undefined,
): { total: Minor; approx: boolean; missingRate: boolean } {
  let total = 0;
  let approx = false;
  let missingRate = false;
  for (const a of accounts) {
    if (a.archived) continue;
    const b = balances.get(a.id) ?? 0;
    if (a.currency === 'KGS') total += b;
    else if (usdtRate) {
      total += usdtToKgs(b, usdtRate);
      approx = true;
    } else if (b !== 0) missingRate = true;
  }
  return { total, approx, missingRate };
}
