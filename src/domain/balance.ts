import { isBase } from './currency';
import { toKgs } from './rate';
import type { Account, Currency, Id, Minor, Rate, Transaction } from './types';

/**
 * Баланс = начальный остаток + доходы − расходы − исходящие переводы + входящие переводы ± долги (SPEC 4.1).
 * Операции раньше даты остатка его не меняют: остаток на эту дату их уже включает.
 * Балансы не хранятся, всегда считаются из операций.
 */
export function computeBalances(accounts: readonly Account[], transactions: readonly Transaction[]): Map<Id, Minor> {
  const balances = new Map<Id, Minor>();
  const openingDate = new Map<Id, string>();
  for (const a of accounts) {
    balances.set(a.id, a.openingBalance);
    openingDate.set(a.id, a.openingDate);
  }
  const add = (id: Id, date: string, delta: Minor) => {
    const current = balances.get(id);
    if (current !== undefined && date >= openingDate.get(id)!) balances.set(id, current + delta);
  };
  for (const t of transactions) {
    if (t.type === 'income') add(t.accountId, t.date, t.amount);
    else if (t.type === 'expense') add(t.accountId, t.date, -t.amount);
    else if (t.type === 'debt') add(t.accountId, t.date, t.flow === 'in' ? t.amount : -t.amount);
    else {
      add(t.accountId, t.date, -t.amount);
      if (t.toAccountId) add(t.toAccountId, t.date, t.toAmount ?? t.amount);
    }
  }
  return balances;
}

/**
 * «Всего ≈ N сом»: сомовые счета + валютные по последнему курсу своей валюты (SPEC 4.2, 4.6).
 * Валюты без курса не учитываются и перечислены в missing.
 */
export function totalInKgs(
  accounts: readonly Account[],
  balances: ReadonlyMap<Id, Minor>,
  rateFor: (currency: Currency) => Rate | undefined,
): { total: Minor; approx: boolean; missing: Currency[] } {
  let total = 0;
  let approx = false;
  const missing = new Set<Currency>();
  for (const a of accounts) {
    if (a.archived) continue;
    const b = balances.get(a.id) ?? 0;
    if (isBase(a.currency)) total += b;
    else {
      const rate = rateFor(a.currency);
      if (rate) {
        total += toKgs(b, rate);
        approx = true;
      } else if (b !== 0) missing.add(a.currency);
    }
  }
  return { total, approx, missing: [...missing] };
}
