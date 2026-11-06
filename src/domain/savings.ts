import { mulDivRound } from './arith';
import { isBase } from './currency';
import { parseLocalDate } from './date';
import { toKgs } from './rate';
import type { Account, Currency, Id, LocalDate, Minor, Rate, SavingsPurpose } from './types';

/** Назначения копилок (этап 20): подпись и значок по умолчанию. */
export const PURPOSES: Record<SavingsPurpose, { label: string; icon: string; color: string }> = {
  savings: { label: 'Накопления', icon: 'PiggyBank', color: 'rose' },
  deposit: { label: 'Депозит', icon: 'Landmark', color: 'blue' },
  cash: { label: 'Наличные', icon: 'Banknote', color: 'green' },
  fund: { label: 'Фонд', icon: 'Target', color: 'violet' },
};

export function isSavings(a: Pick<Account, 'type'>): boolean {
  return a.type === 'savings';
}

/** Обычные счета — без копилок: «Счета» на «Сегодня», лимит. */
export function everydayAccounts<T extends Pick<Account, 'type' | 'archived'>>(accounts: readonly T[]): T[] {
  return accounts.filter((a) => !a.archived && !isSavings(a));
}

export function activeJars<T extends Pick<Account, 'type' | 'archived'>>(accounts: readonly T[]): T[] {
  return accounts.filter((a) => !a.archived && isSavings(a));
}

export interface JarState {
  jar: Account;
  balance: Minor;
  /** 0–100, если есть цель. */
  percent?: number;
  /** Сколько ещё накопить до цели. */
  left?: Minor;
  /** Сколько откладывать в месяц, чтобы успеть к сроку. */
  perMonth?: Minor;
  reached: boolean;
}

/** Месяцев до срока по календарю, не меньше 1: 6 ноября → 15 марта = 4. */
export function monthsUntil(today: LocalDate, date: LocalDate): number {
  const a = parseLocalDate(today);
  const b = parseLocalDate(date);
  return Math.max(1, (b.year - a.year) * 12 + (b.month - a.month));
}

export function jarState(jar: Account, balance: Minor, today: LocalDate): JarState {
  if (!jar.goal || jar.goal <= 0) return { jar, balance, reached: false };
  const percent = Math.max(0, Math.min(100, mulDivRound(Math.max(0, balance), 100, jar.goal)));
  const left = Math.max(0, jar.goal - balance);
  const reached = left === 0;
  const perMonth = !reached && jar.goalDate && jar.goalDate > today ? Math.ceil(left / monthsUntil(today, jar.goalDate)) : undefined;
  return { jar, balance, percent, left, reached, ...(perMonth !== undefined ? { perMonth } : {}) };
}

/** Итог копилок: по валютам и ≈ в сомах по последнему курсу (без курса — в missing). */
export function savingsTotals(
  jars: readonly Account[],
  balances: ReadonlyMap<Id, Minor>,
  rateFor: (c: Currency) => Rate | undefined,
): { byCurrency: Map<Currency, Minor>; kgs: Minor; approx: boolean; missing: Currency[] } {
  const byCurrency = new Map<Currency, Minor>();
  let kgs = 0;
  let approx = false;
  const missing = new Set<Currency>();
  for (const j of jars) {
    const b = balances.get(j.id) ?? 0;
    byCurrency.set(j.currency, (byCurrency.get(j.currency) ?? 0) + b);
    if (isBase(j.currency)) kgs += b;
    else {
      const r = rateFor(j.currency);
      if (r) {
        kgs += toKgs(b, r);
        approx = true;
      } else missing.add(j.currency);
    }
  }
  return { byCurrency, kgs, approx, missing: [...missing] };
}
