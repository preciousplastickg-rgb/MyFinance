import { floorDiv, mulDivRound } from './arith';
import { addMonths, diffDays, monthOf, monthPrepositional, type MonthKey } from './date';
import { txInKgs } from './history';
import { formatAmount, plural } from './money';
import { BASE_CURRENCY, isBase } from './currency';
import { savedRate, toKgs, type RateBook } from './rate';
import { monthlyEquivalent } from './recurring';
import type { Account, Category, Id, LocalDate, Minor, Recurring, Settings, Transaction } from './types';

export interface CategoryStat {
  category: Category;
  total: Minor; // сомы
  count: number;
  approx: boolean;
  /** Среднее за предыдущие месяцы с данными (из 3 полных). */
  average?: Minor;
  /** Δ к среднему, % (целое), только если сравнения включены и |Δ| ≥ 10%. */
  delta?: number;
}

export interface Segment {
  key: string;
  name: string;
  color: string;
  total: Minor;
}

export interface Insight {
  kind: 'growth' | 'subscriptions' | 'small';
  title: string;
  text: string;
  amount: Minor;
  categoryId?: Id;
}

export interface MonthReport {
  month: MonthKey;
  totalExpense: Minor;
  approx: boolean;
  byCategory: CategoryStat[];
  segments: Segment[];
  fixed: Minor;
  variable: Minor;
  /** Доходы по источникам; ids — операции, чтобы открыть их из отчёта. noRate — суммы в валюте, для которой нет курса: в total они не вошли. */
  incomes: { name: string; total: Minor; approx: boolean; ids: Id[]; noRate: { currency: string; amount: Minor }[] }[];
  totalIncome: Minor;
  /** Расходы месяца по счетам, по убыванию; ids — операции, чтобы открыть их из отчёта. */
  byAccount: { accountId: Id; total: Minor; approx: boolean; ids: Id[] }[];
  /** Меньше 30 дней записей — без сравнений и карточек (SPEC 6). */
  comparisons: boolean;
  /** Текущий месяц: прошлые месяцы сравниваются по то же число, а не целиком. */
  sameDay?: number;
  insights: Insight[];
}

export interface ReportInput {
  month: MonthKey;
  today: LocalDate;
  transactions: readonly Transaction[];
  accountById: ReadonlyMap<Id, Account>;
  categoryById: ReadonlyMap<Id, Category>;
  recurring: readonly Recurring[];
  rates: RateBook;
  settings: Settings;
}

const MAX_SEGMENTS = 6;

interface Converted {
  t: Transaction;
  kgs: Minor;
  approx: boolean;
}

function convert(t: Transaction, accountById: ReadonlyMap<Id, Account>, rates: RateBook): Converted {
  const currency = accountById.get(t.accountId)?.currency ?? BASE_CURRENCY;
  const k = txInKgs(t, currency, rates);
  return { t, kgs: k.value, approx: k.approx };
}

/** Расходы месяца по категориям в сомах; переводы не учитываются. throughDay — только дни месяца до этого числа включительно. */
export function expensesByCategory(
  transactions: readonly Transaction[],
  month: MonthKey,
  accountById: ReadonlyMap<Id, Account>,
  rates: RateBook,
  throughDay = 31,
): Map<Id, { total: Minor; count: number; approx: boolean }> {
  const out = new Map<Id, { total: Minor; count: number; approx: boolean }>();
  for (const t of transactions) {
    if (t.type !== 'expense' || monthOf(t.date) !== month || Number(t.date.slice(8, 10)) > throughDay) continue;
    const c = convert(t, accountById, rates);
    const id = t.categoryId ?? '';
    const cur = out.get(id) ?? { total: 0, count: 0, approx: false };
    out.set(id, { total: cur.total + c.kgs, count: cur.count + 1, approx: cur.approx || c.approx });
  }
  return out;
}

/** Δ к среднему за 3 предыдущих полных месяца; показывается при ≥ 2 месяцах данных и |Δ| ≥ 10%. */
export function deltaPercent(current: Minor, average: Minor): number | undefined {
  if (average <= 0) return undefined;
  const d = mulDivRound(current - average, 100, average);
  return Math.abs(d) >= 10 ? d : undefined;
}

export function monthReport(input: ReportInput): MonthReport {
  const { month, today, transactions, accountById, categoryById, recurring, rates, settings } = input;
  // Один проход по всем операциям: первая дата (для сравнений) и операции нужных месяцев — этого и трёх предыдущих.
  // Дальше всё считается по этим корзинам, а не по всей истории заново на каждый блок отчёта.
  const prevMonths = [1, 2, 3].map((i) => addMonths(month, -i));
  const wanted = new Set<MonthKey>([month, ...prevMonths]);
  const byMonth = new Map<MonthKey, Transaction[]>();
  let first: LocalDate | undefined;
  for (const t of transactions) {
    if (!first || t.date < first) first = t.date;
    const m = monthOf(t.date);
    if (!wanted.has(m)) continue;
    const list = byMonth.get(m);
    if (list) list.push(t);
    else byMonth.set(m, [t]);
  }
  const monthTxs = byMonth.get(month) ?? [];
  const byCat = expensesByCategory(monthTxs, month, accountById, rates);

  // Сравнения: месяцы с данными среди трёх предыдущих.
  const comparisons = !!first && diffDays(first, today) + 1 >= 30;
  const monthsWithData = prevMonths.filter((m) => byMonth.has(m));
  // Текущий месяц ещё не кончился: 4 ноября сравниваем с 1–4 числом прошлых месяцев, а не с полными месяцами.
  const sameDay = month === monthOf(today) ? Number(today.slice(8, 10)) : undefined;
  const prevByCat = monthsWithData.map((m) => expensesByCategory(byMonth.get(m)!, m, accountById, rates, sameDay));

  const byCategory: CategoryStat[] = [];
  let totalExpense = 0;
  let approx = false;
  for (const [id, v] of byCat) {
    const category = categoryById.get(id) ?? {
      id, name: 'Без категории', kind: 'expense' as const, icon: 'Ellipsis', color: 'slate', isFixed: false, sortOrder: 999, archived: false,
    };
    totalExpense += v.total;
    approx ||= v.approx;
    const stat: CategoryStat = { category, ...v };
    if (comparisons && monthsWithData.length >= 2) {
      const sum = prevByCat.reduce((s, m) => s + (m.get(id)?.total ?? 0), 0);
      stat.average = floorDiv(sum, monthsWithData.length * 100) * 100; // до сома: «обычно 2 727», а не «2 726,66»
      stat.delta = deltaPercent(v.total, stat.average);
    }
    byCategory.push(stat);
  }
  byCategory.sort((a, b) => b.total - a.total || a.category.sortOrder - b.category.sortOrder);

  const segments: Segment[] = byCategory.slice(0, MAX_SEGMENTS).map((s) => ({
    key: s.category.id, name: s.category.name, color: s.category.color, total: s.total,
  }));
  const rest = byCategory.slice(MAX_SEGMENTS).reduce((s, c) => s + c.total, 0);
  if (rest > 0) segments.push({ key: '__rest', name: 'Прочее', color: 'slate', total: rest });

  const fixed = byCategory.filter((s) => s.category.isFixed).reduce((s, c) => s + c.total, 0);

  // Доходы по источникам: регулярный источник по имени, иначе категория.
  const recurringById = new Map(recurring.map((r) => [r.id, r]));
  const incomeMap = new Map<string, { total: Minor; approx: boolean; ids: Id[]; noRate: { currency: string; amount: Minor }[] }>();
  let totalIncome = 0;
  for (const t of monthTxs) {
    if (t.type !== 'income') continue;
    const currency = accountById.get(t.accountId)?.currency ?? BASE_CURRENCY;
    const k = txInKgs(t, currency, rates);
    const name = (t.recurringId && recurringById.get(t.recurringId)?.name) || (t.categoryId && categoryById.get(t.categoryId)?.name) || 'Доход';
    let cur = incomeMap.get(name);
    if (!cur) {
      cur = { total: 0, approx: false, ids: [], noRate: [] };
      incomeMap.set(name, cur);
    }
    cur.total += k.value;
    cur.approx ||= k.approx;
    cur.ids.push(t.id);
    // Валюта без курса: сумму в сомах не выдумываем, но и не теряем — показываем как есть.
    if (k.missing) {
      const found = cur.noRate.find((n) => n.currency === currency);
      if (found) found.amount += t.amount;
      else cur.noRate.push({ currency, amount: t.amount });
    }
    totalIncome += k.value;
  }
  const incomes = [...incomeMap.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);

  const insights = comparisons
    ? buildInsights({ month, byCategory, totalExpense, transactions: monthTxs, accountById, rates, recurring, settings, sameDay })
    : [];

  const accMap = new Map<Id, { total: Minor; approx: boolean; ids: Id[] }>();
  for (const t of monthTxs) {
    if (t.type !== 'expense') continue;
    const k = convert(t, accountById, rates);
    let cur = accMap.get(t.accountId);
    if (!cur) {
      cur = { total: 0, approx: false, ids: [] };
      accMap.set(t.accountId, cur);
    }
    cur.total += k.kgs;
    cur.approx ||= k.approx;
    cur.ids.push(t.id);
  }
  const byAccount = [...accMap.entries()].map(([accountId, v]) => ({ accountId, ...v })).sort((a, b) => b.total - a.total);

  return {
    month, totalExpense, approx, byCategory, segments, fixed, variable: totalExpense - fixed, incomes, totalIncome, byAccount, comparisons, insights,
    ...(sameDay ? { sameDay } : {}),
  };
}

const fmt = (v: Minor) => formatAmount(v);

function buildInsights(p: {
  month: MonthKey;
  byCategory: CategoryStat[];
  totalExpense: Minor;
  transactions: readonly Transaction[];
  accountById: ReadonlyMap<Id, Account>;
  rates: RateBook;
  recurring: readonly Recurring[];
  settings: Settings;
  sameDay?: number;
}): Insight[] {
  const out: Insight[] = [];

  // 1. Рост категории: Δ ≥ +20% и сумма ≥ 1 000 сом.
  for (const s of p.byCategory) {
    if (s.delta !== undefined && s.delta >= 20 && s.total >= 100_000 && s.average !== undefined) {
      const avgCheck = mulDivRound(s.total, 1, s.count * 100) * 100;
      out.push({
        kind: 'growth',
        title: `${s.category.name} +${s.delta}%`,
        text: `${fmt(s.total)} сом в ${monthPrepositional(p.month)} при обычных ${fmt(s.average)} (${p.sameDay ? `в среднем к ${p.sameDay}-му числу` : 'среднее за 3 месяца'}). ${s.count} ${plural(s.count, ['покупка', 'покупки', 'покупок'])}, средний чек ${fmt(avgCheck)}`,
        amount: s.total,
        categoryId: s.category.id,
      });
    }
  }

  // 2. Подписки: активные регулярные с isSubscription.
  const subs = p.recurring.filter((r) => r.active && r.isSubscription && r.kind === 'expense');
  if (subs.length) {
    const monthly = subs.reduce((s, r) => {
      const m = monthlyEquivalent(r);
      if (isBase(r.currency)) return s + m;
      const rate = savedRate(p.settings, r.currency)?.rate;
      return s + (rate ? toKgs(m, rate) : 0);
    }, 0);
    out.push({
      kind: 'subscriptions',
      title: 'Подписки',
      text: `${subs.length} ${plural(subs.length, ['подписка', 'подписки', 'подписок'])}, ${fmt(monthly)} сом в месяц = ${fmt(monthly * 12)} в год`,
      amount: monthly,
    });
  }

  // 3. Мелкие траты: меньше порога, если их доля ≥ 10% расходов.
  let count = 0;
  let sum = 0;
  for (const t of p.transactions) {
    if (t.type !== 'expense' || monthOf(t.date) !== p.month) continue;
    const c = convert(t, p.accountById, p.rates);
    if (c.kgs < p.settings.smallExpenseThreshold) {
      count++;
      sum += c.kgs;
    }
  }
  if (p.totalExpense > 0 && sum * 10 >= p.totalExpense) {
    const share = floorDiv(sum * 100, p.totalExpense);
    out.push({
      kind: 'small',
      title: 'Мелкие траты',
      text: `${count} ${plural(count, ['покупка', 'покупки', 'покупок'])}, ${fmt(sum)} сом — ${share}% всех расходов`,
      amount: sum,
    });
  }

  return out.sort((a, b) => b.amount - a.amount).slice(0, 3);
}

/** Столбцы за 6 месяцев по категории, заканчивая выбранным. */
export function categoryTrend(
  categoryId: Id,
  month: MonthKey,
  transactions: readonly Transaction[],
  accountById: ReadonlyMap<Id, Account>,
  rates: RateBook,
): { month: MonthKey; total: Minor }[] {
  return [5, 4, 3, 2, 1, 0].map((i) => {
    const m = addMonths(month, -i);
    return { month: m, total: expensesByCategory(transactions, m, accountById, rates).get(categoryId)?.total ?? 0 };
  });
}
