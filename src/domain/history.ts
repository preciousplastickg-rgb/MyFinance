import { formatAmount } from './money';
import { rateOn, usdtToKgs, type RatePoint } from './rate';
import type { Account, Category, Id, LocalDate, Minor, Transaction } from './types';

/** Сумма операции в сомах: сомовый счёт — как есть, USDT — по курсу на дату (SPEC 4.2). */
export function amountInKgs(
  amount: Minor,
  currency: Account['currency'],
  date: LocalDate,
  rates: readonly RatePoint[],
): { value: Minor; approx: boolean; missing: boolean } {
  if (currency === 'KGS') return { value: amount, approx: false, missing: false };
  const rate = rateOn(rates, date);
  if (!rate) return { value: 0, approx: true, missing: true };
  return { value: usdtToKgs(amount, rate), approx: true, missing: false };
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
  rates: readonly RatePoint[],
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
        if (t.type === 'transfer') continue;
        const currency = accountById.get(t.accountId)?.currency ?? 'KGS';
        const k = amountInKgs(t.amount, currency, t.date, rates);
        approx ||= k.approx;
        total += t.type === 'income' ? k.value : -k.value;
      }
      items.sort((a, b) => b.createdAt - a.createdAt);
      return { date, items, total, approx };
    });
}

export interface MonthTotals {
  income: Minor; // сомовые счета
  expense: Minor;
  usdtIncome: Minor; // USDT-счета, в USDT
  usdtExpense: Minor;
  usdtIncomeKgs: Minor; // ≈ в сомах по курсу на дату операции
  usdtExpenseKgs: Minor;
}

/** Доходы и расходы месяца. Переводы не учитываются (SPEC 4.2). */
export function monthTotals(
  transactions: readonly Transaction[],
  accountById: ReadonlyMap<Id, Account>,
  rates: readonly RatePoint[],
): MonthTotals {
  const r: MonthTotals = { income: 0, expense: 0, usdtIncome: 0, usdtExpense: 0, usdtIncomeKgs: 0, usdtExpenseKgs: 0 };
  for (const t of transactions) {
    if (t.type === 'transfer') continue;
    const currency = accountById.get(t.accountId)?.currency ?? 'KGS';
    if (currency === 'KGS') {
      if (t.type === 'income') r.income += t.amount;
      else r.expense += t.amount;
    } else {
      const kgs = amountInKgs(t.amount, 'USDT', t.date, rates).value;
      if (t.type === 'income') {
        r.usdtIncome += t.amount;
        r.usdtIncomeKgs += kgs;
      } else {
        r.usdtExpense += t.amount;
        r.usdtExpenseKgs += kgs;
      }
    }
  }
  return r;
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
