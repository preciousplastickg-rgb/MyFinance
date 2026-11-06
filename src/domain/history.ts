import { formatAmount } from './money';
import { BASE_CURRENCY, isBase } from './currency';
import { rateOn, toKgs, type RateBook } from './rate';
import { monthOf, type MonthKey } from './date';
import type { Account, Category, Currency, Id, LocalDate, Minor, Transaction } from './types';

/** Сумма операции в сомах: сомовый счёт — как есть, валюта — по курсу своей валюты на дату (SPEC 4.2, 4.6). */
export function amountInKgs(
  amount: Minor,
  currency: Currency,
  date: LocalDate,
  rates: RateBook,
): { value: Minor; approx: boolean; missing: boolean } {
  if (isBase(currency)) return { value: amount, approx: false, missing: false };
  const rate = rateOn(rates.get(currency), date);
  if (!rate) return { value: 0, approx: true, missing: true };
  return { value: toKgs(amount, rate), approx: true, missing: false };
}

/**
 * Операция в сомах. У траты или дохода с валютного счёта свой курс (этап 16) — по нему, точно;
 * иначе — по истории курсов на дату операции, «≈».
 */
export function txInKgs(t: Transaction, currency: Currency, rates: RateBook): { value: Minor; approx: boolean; missing: boolean } {
  if (!isBase(currency) && (t.type === 'expense' || t.type === 'income') && t.rate) return { value: toKgs(t.amount, t.rate), approx: false, missing: false };
  return amountInKgs(t.amount, currency, t.date, rates);
}

export interface DayGroup {
  date: LocalDate;
  items: Transaction[];
  /** Итог дня без переводов, в сомах: доходы − расходы. */
  total: Minor;
  approx: boolean;
}

/** Список по дням, новые сверху; внутри дня — по времени создания, новые сверху. */
export function groupByDay(
  transactions: readonly Transaction[],
  accountById: ReadonlyMap<Id, Account>,
  rates: RateBook,
): DayGroup[] {
  const byDate = new Map<LocalDate, Transaction[]>();
  for (const t of transactions) {
    const list = byDate.get(t.date);
    if (list) list.push(t);
    else byDate.set(t.date, [t]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, items]) => {
      let total = 0;
      let approx = false;
      for (const t of items) {
        if (t.type !== 'expense' && t.type !== 'income') continue; // переводы и долги — не доход и не расход
        const currency = accountById.get(t.accountId)?.currency ?? BASE_CURRENCY;
        const k = txInKgs(t, currency, rates);
        approx ||= k.approx;
        total += t.type === 'income' ? k.value : -k.value;
      }
      items.sort((a, b) => b.createdAt - a.createdAt);
      return { date, items, total, approx };
    });
}

export interface ForeignTotals {
  currency: Currency;
  income: Minor; // в валюте
  expense: Minor;
  incomeKgs: Minor; // ≈ в сомах по курсу на дату операции
  expenseKgs: Minor;
}

export interface MonthTotals {
  income: Minor; // сомовые счета
  expense: Minor;
  /** Валютные счета — отдельной строкой на каждую валюту (SPEC 5.3, 4.6). */
  foreign: ForeignTotals[];
}

/** Доходы и расходы месяца. Переводы не учитываются (SPEC 4.2). */
export function monthTotals(
  transactions: readonly Transaction[],
  accountById: ReadonlyMap<Id, Account>,
  rates: RateBook,
): MonthTotals {
  const r: MonthTotals = { income: 0, expense: 0, foreign: [] };
  const byCurrency = new Map<Currency, ForeignTotals>();
  for (const t of transactions) {
    if (t.type !== 'expense' && t.type !== 'income') continue; // переводы и долги — не доход и не расход
    const currency = accountById.get(t.accountId)?.currency ?? BASE_CURRENCY;
    if (isBase(currency)) {
      if (t.type === 'income') r.income += t.amount;
      else r.expense += t.amount;
      continue;
    }
    const f = byCurrency.get(currency) ?? { currency, income: 0, expense: 0, incomeKgs: 0, expenseKgs: 0 };
    const kgs = txInKgs(t, currency, rates).value;
    if (t.type === 'income') {
      f.income += t.amount;
      f.incomeKgs += kgs;
    } else {
      f.expense += t.amount;
      f.expenseKgs += kgs;
    }
    byCurrency.set(currency, f);
  }
  r.foreign = [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency));
  return r;
}

/** Все расходы месяца в сомах — сомовые и валютные по курсу. */
export function totalExpenseKgs(t: MonthTotals): Minor {
  return t.expense + t.foreign.reduce((s, f) => s + f.expenseKgs, 0);
}

/** Поиск по категории, комментарию и сумме (SPEC 5.3). */
export function matchesQuery(
  t: Transaction,
  query: string,
  categoryById: ReadonlyMap<Id, Category>,
  accountById: ReadonlyMap<Id, Account>,
): boolean {
  const q = query.trim().toLowerCase().replace(/ё/g, 'е');
  if (!q) return true;
  const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');
  if (t.note && norm(t.note).includes(q)) return true;
  const category = t.categoryId ? categoryById.get(t.categoryId) : undefined;
  if (category && norm(category.name).includes(q)) return true;
  if (t.type === 'transfer') {
    const names = [t.accountId, t.toAccountId].map((id) => (id ? accountById.get(id)?.name ?? '' : ''));
    if (names.some((n) => norm(n).includes(q)) || 'перевод'.includes(q)) return true;
  }
  const digits = q.replace(/[\s ]/g, '').replace('.', ',');
  if (/^\d+(,\d*)?$/.test(digits)) {
    const amounts = [t.amount, t.toAmount].filter((a): a is number => a !== undefined);
    return amounts.some((a) => formatAmount(a).replace(/ /g, '').startsWith(digits));
  }
  return false;
}

/** Последний месяц, который есть смысл листать: текущий или месяц самой поздней записи, если она в будущем. */
export function latestMonth(transactions: readonly Pick<Transaction, 'date'>[], today: LocalDate): MonthKey {
  let max = monthOf(today);
  for (const t of transactions) {
    const m = monthOf(t.date);
    if (m > max) max = m;
  }
  return max;
}
