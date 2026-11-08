import { floorDiv, mulDivRound } from './arith';
import { addMonths, daysInMonth, diffDays, endOfMonth, monthOf, monthPrepositional, type MonthKey } from './date';
import { txInKgs } from './history';
import { formatAmount, plural } from './money';
import { BASE_CURRENCY, isBase } from './currency';
import { savedRate, toKgs, type RateBook } from './rate';
import { describeSchedule, monthlyEquivalent } from './recurring';
import type { Account, Category, Currency, Id, LocalDate, Minor, Recurring, Settings, Transaction } from './types';

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

export interface Insight {
  /** limit — категория сверх месячного лимита (этап 23). */
  kind: 'growth' | 'subscriptions' | 'small' | 'limit';
  title: string;
  text: string;
  amount: Minor;
  /** Выгода справа в карточке, `--accent` (этап 22): «+1 540», «9 600 в год», «16%». */
  gain: string;
  categoryId?: Id;
}

export interface MonthReport {
  month: MonthKey;
  totalExpense: Minor;
  approx: boolean;
  byCategory: CategoryStat[];
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
  /** Первая запись вообще — с какого месяца есть данные (для «за полгода» в «Куда ушли деньги»). */
  firstDate?: LocalDate;
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

  // Карточки «Где можно сократить»: сравнения и подписки — после 30 дней записей, перерасход лимита — всегда.
  // Категория сверх лимита не дублируется карточкой роста: лимит конкретнее.
  const overLimit = limitInsights(byCategory, month);
  const overIds = new Set(overLimit.map((i) => i.categoryId));
  const insights = [
    ...(comparisons ? buildInsights({ month, byCategory, totalExpense, transactions: monthTxs, accountById, rates, recurring, settings, sameDay }) : []).filter(
      (i) => !(i.kind === 'growth' && overIds.has(i.categoryId)),
    ),
    ...overLimit,
  ]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, MAX_INSIGHTS);

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
    month, totalExpense, approx, byCategory, fixed, variable: totalExpense - fixed, incomes, totalIncome, byAccount, comparisons, insights,
    ...(sameDay ? { sameDay } : {}),
    ...(first ? { firstDate: first } : {}),
  };
}

const fmt = (v: Minor) => formatAmount(v);
const MAX_INSIGHTS = 3;

/** 4. Сверх лимита (этап 23): категория с лимитом, расходы месяца больше него. */
function limitInsights(byCategory: readonly CategoryStat[], month: MonthKey): Insight[] {
  const out: Insight[] = [];
  for (const s of byCategory) {
    const limit = s.category.limit ?? 0;
    if (limit <= 0 || s.total <= limit || s.count === 0) continue;
    const avgCheck = mulDivRound(s.total, 1, s.count * 100) * 100;
    out.push({
      kind: 'limit',
      title: `${s.category.name} сверх лимита`,
      text: `${fmt(s.total)} сом в ${monthPrepositional(month)} при лимите ${fmt(limit)}. ${s.count} ${plural(s.count, ['покупка', 'покупки', 'покупок'])}, средний чек ${fmt(avgCheck)}`,
      amount: s.total,
      gain: `+${fmt(s.total - limit)}`,
      categoryId: s.category.id,
    });
  }
  return out;
}

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

  // 1. Рост категории: Δ ≥ +20% и сумма ≥ 1 000 сом. Обязательные (аренда, связь) не «сокращаются» — их рост не карточка.
  for (const s of p.byCategory) {
    if (!s.category.isFixed && s.delta !== undefined && s.delta >= 20 && s.total >= 100_000 && s.average !== undefined) {
      const avgCheck = mulDivRound(s.total, 1, s.count * 100) * 100;
      out.push({
        kind: 'growth',
        title: `${s.category.name} +${s.delta}%`,
        text: `${fmt(s.total)} сом в ${monthPrepositional(p.month)} при обычных ${fmt(s.average)} (${p.sameDay ? `в среднем к ${p.sameDay}-му числу` : 'среднее за 3 месяца'}). ${s.count} ${plural(s.count, ['покупка', 'покупки', 'покупок'])}, средний чек ${fmt(avgCheck)}`,
        amount: s.total,
        gain: `+${fmt(s.total - s.average)}`,
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
      gain: `${fmt(monthly * 12)} в год`,
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
      gain: `${share}%`,
    });
  }

  return out;
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

// ───────────────────────── Этап 30: «Куда ушли деньги» ─────────────────────────

export interface CategoryShare {
  id: Id;
  /** Доля в расходах месяца, % (целые; в сумме по всем категориям ровно 100). */
  percent: number;
  /** Длина полосы под названием — от самой большой категории месяца, % (0–100). */
  rel: number;
}

/**
 * Доли категорий в расходах месяца для полосы и строк «Куда ушли деньги». Проценты — методом наибольших остатков:
 * каждая доля округлена вниз, недостающие до 100 единицы получают категории с самыми большими остатками, — поэтому сумма
 * ровно 100, а не 99 или 101. Сегменты полосы делят ширину по самим суммам (flex-grow), без округления.
 */
export function categoryShares(byCategory: readonly CategoryStat[]): CategoryShare[] {
  const total = byCategory.reduce((s, c) => s + c.total, 0);
  if (total <= 0) return byCategory.map((c) => ({ id: c.category.id, percent: 0, rel: 0 }));
  const max = Math.max(...byCategory.map((c) => c.total));
  const rows = byCategory.map((c, i) => ({ i, id: c.category.id, percent: floorDiv(c.total * 100, total), rest: (c.total * 100) % total, rel: mulDivRound(c.total, 100, max) }));
  let missing = 100 - rows.reduce((s, r) => s + r.percent, 0);
  for (const r of [...rows].sort((a, b) => b.rest - a.rest || a.i - b.i)) {
    if (missing <= 0) break;
    r.percent++;
    missing--;
  }
  return rows.map(({ id, percent, rel }) => ({ id, percent, rel }));
}

export interface CategoryCard {
  /** «15% всех расходов». */
  share: number;
  /** «Обычно 4 060» — среднее за 3 предыдущих полных месяца, как Δ. */
  usual?: Minor;
  /** «за полгода 3 900–5 600» — по полным месяцам спарклайна (без неполного первого с записями и без текущего); меньше двух — нет. */
  range?: { min: Minor; max: Minor };
  /** Переменные: «22 покупки · средний чек 255». */
  purchases?: { count: number; avgCheck: Minor };
  /** Обязательные: откуда — «Аренда · 1-го числа» (регулярный платёж этой категории). */
  source?: string;
  /** Спарклайн: 6 месяцев, последний — месяц отчёта. */
  trend: { month: MonthKey; total: Minor }[];
}

/**
 * Раскрытая строка «Куда ушли деньги»: спарклайн за полгода, доля, «обычно», покупки или источник. today — чтобы не брать
 * в «за полгода» текущий месяц (он ещё не кончился) и первый месяц записей, если начали не с 1-го числа: их суммы неполные.
 */
export function categoryCard(
  stat: CategoryStat,
  share: number,
  trend: readonly { month: MonthKey; total: Minor }[],
  recurring: readonly Recurring[],
  firstDate?: LocalDate,
  today?: LocalDate,
): CategoryCard {
  const card: CategoryCard = { share, trend: [...trend] };
  if (stat.average !== undefined) card.usual = stat.average;
  const fullFrom = firstDate ? (firstDate.endsWith('-01') ? monthOf(firstDate) : addMonths(monthOf(firstDate), 1)) : undefined;
  const known = fullFrom ? trend.filter((t) => t.month >= fullFrom && (!today || t.month < monthOf(today))) : [];
  if (known.length >= 2) card.range = { min: Math.min(...known.map((t) => t.total)), max: Math.max(...known.map((t) => t.total)) };
  if (stat.category.isFixed) {
    const r = recurring
      .filter((x) => x.kind === 'expense' && x.categoryId === stat.category.id && x.active && !x.deletedAt)
      .sort((a, b) => b.amount - a.amount)[0];
    if (r) card.source = `${r.name} · ${describeSchedule(r.schedule)}`;
  } else if (stat.count > 0) {
    card.purchases = { count: stat.count, avgCheck: mulDivRound(stat.total, 1, stat.count * 100) * 100 };
  }
  return card;
}

// ───────────────────────── Этап 22: итог месяца, темп, движение по счетам ─────────────────────────

/** «Больше всего вырос» — только при росте не меньше 300 сом к среднему (SPEC 6, этап 22). */
export const TOP_GROWTH_MIN: Minor = 30_000;

export interface MonthSummary {
  expense: Minor;
  income: Minor;
  /** Доходы − расходы; может быть отрицательным. */
  left: Minor;
  /** Доходы с валютой по курсу — «≈». */
  incomeApprox: boolean;
  /** Валюты доходов месяца кроме сома, по алфавиту — подпись «≈ с USDT» под «Доходами». */
  foreignIncome: Currency[];
  expenseApprox: boolean;
  /** Δ расходов к прошлому месяцу, % (для текущего месяца — к тем же числам прошлого). Нет — в прошлом месяце расходов не было. */
  vsPrev?: number;
  prevMonth: MonthKey;
  /** Доля расходов от доходов, % вниз до целого. Нет — доходов нет. */
  spentShare?: number;
  /**
   * Категория с наибольшим ростом в сомах к среднему за 3 месяца.
   * null — сравнения есть, но роста ≥ 300 сом нет («без резких скачков»); undefined — сравнений нет.
   */
  topGrowth?: { categoryId: Id; name: string; amount: Minor } | null;
}

/** Итог месяца над кольцом (этап 22). Считается из готового отчёта, чтобы суммы совпадали с кольцом и «Доходами» до тыйына. */
export function monthSummary(report: MonthReport, input: Pick<ReportInput, 'transactions' | 'accountById' | 'rates'>): MonthSummary {
  const prevMonth = addMonths(report.month, -1);
  const prev = expensesByCategory(input.transactions, prevMonth, input.accountById, input.rates, report.sameDay ?? 31);
  let prevExpense = 0;
  for (const v of prev.values()) prevExpense += v.total;
  const expense = report.totalExpense;
  const income = report.totalIncome;
  const foreignIncome = [
    ...new Set(
      input.transactions
        .filter((t) => t.type === 'income' && monthOf(t.date) === report.month)
        .map((t) => input.accountById.get(t.accountId)?.currency ?? BASE_CURRENCY)
        .filter((c) => !isBase(c)),
    ),
  ].sort();
  const out: MonthSummary = {
    expense,
    income,
    left: income - expense,
    incomeApprox: report.incomes.some((i) => i.approx),
    foreignIncome,
    expenseApprox: report.approx,
    prevMonth,
  };
  if (prevExpense > 0) out.vsPrev = mulDivRound(expense - prevExpense, 100, prevExpense);
  if (income > 0) out.spentShare = floorDiv(expense * 100, income);
  const withAvg = report.byCategory.filter((c) => c.average !== undefined && !c.category.isFixed); // аренда «выросла» — не новость
  if (withAvg.length) {
    let best: CategoryStat | undefined;
    for (const c of withAvg) if (!best || c.total - c.average! > best.total - best.average!) best = c;
    const amount = best!.total - best!.average!;
    out.topGrowth = amount >= TOP_GROWTH_MIN ? { categoryId: best!.category.id, name: best!.category.name, amount } : null;
  }
  return out;
}

export interface PaceSeries {
  /** Дней в месяце — ширина графика. */
  days: number;
  /** Последний день линии: сегодня для текущего месяца, иначе последний день месяца. */
  lastDay: number;
  /** Накопленные расходы в сомах на конец дня 1…lastDay (с обязательными). */
  cumulative: Minor[];
  approx: boolean;
  /** «Обычный месяц» — средний расход за 3 предыдущих полных месяца; нет при < 2 месяцах данных или < 30 днях записей. */
  plan?: Minor;
  /** Пунктир на lastDay: plan × lastDay / days. */
  planAtLast?: Minor;
  /** Факт − пунктир на lastDay. */
  diff?: Minor;
}

/** «Темп месяца» (этап 22): накопленные расходы по дням против обычного месяца. */
export function paceSeries(input: Pick<ReportInput, 'month' | 'today' | 'transactions' | 'accountById' | 'rates'>): PaceSeries {
  const { month, today, transactions, accountById, rates } = input;
  const [y, m] = month.split('-').map(Number) as [number, number];
  const days = daysInMonth(y, m);
  const lastDay = month === monthOf(today) ? Number(today.slice(8, 10)) : days;
  const daily: Minor[] = new Array(days).fill(0);
  const prevMonths = [1, 2, 3].map((i) => addMonths(month, -i));
  const prevTotals = new Map<MonthKey, Minor>();
  let first: LocalDate | undefined;
  let approx = false;
  for (const t of transactions) {
    if (!first || t.date < first) first = t.date;
    const tm = monthOf(t.date);
    const isPrev = prevMonths.includes(tm);
    if (isPrev && !prevTotals.has(tm)) prevTotals.set(tm, 0);
    if (t.type !== 'expense') continue;
    if (tm === month) {
      const d = Number(t.date.slice(8, 10));
      if (d > lastDay) continue;
      const c = convert(t, accountById, rates);
      daily[d - 1]! += c.kgs;
      approx ||= c.approx;
    } else if (isPrev) {
      prevTotals.set(tm, prevTotals.get(tm)! + convert(t, accountById, rates).kgs);
    }
  }
  const cumulative: Minor[] = [];
  let acc = 0;
  for (let d = 0; d < lastDay; d++) cumulative.push((acc += daily[d]!));
  const out: PaceSeries = { days, lastDay, cumulative, approx };
  const comparisons = !!first && diffDays(first, today) + 1 >= 30;
  if (comparisons && prevTotals.size >= 2) {
    const sum = [...prevTotals.values()].reduce((a, b) => a + b, 0);
    const plan = floorDiv(sum, prevTotals.size * 100) * 100;
    const planAtLast = mulDivRound(plan, lastDay, days);
    Object.assign(out, { plan, planAtLast, diff: (cumulative[lastDay - 1] ?? 0) - planAtLast });
  }
  return out;
}

export interface FlowLine {
  key: string;
  label: string;
  /** Со знаком, в валюте счёта: + пришло, − ушло. */
  amount: Minor;
  ids: Id[];
}

export interface AccountFlow {
  account: Account;
  /** Остаток на начало периода (или начальный остаток, если счёт заведён в этом периоде — тогда startDate = openingDate). */
  start: Minor;
  startDate: LocalDate;
  end: Minor;
  /** Пришло: доходы + входящие переводы (toAmount) + долги in. В валюте счёта. */
  inflow: Minor;
  /** Ушло: расходы + исходящие переводы (amount) + долги out. В валюте счёта. */
  outflow: Minor;
  lines: FlowLine[];
}

const LINE_ORDER = ['inc', 'from', 'fromSav', 'debtIn', 'exp', 'to', 'toSav', 'debtOut'];

/**
 * «По счетам» (этап 22): движение денег по каждому счёту за месяц — единственный блок отчёта с переводами и долгами.
 * Остаток — по SPEC 4.1 (операции раньше openingDate не считаются). Всегда start + inflow − outflow = end.
 * Копилки строками не идут — только как «В копилки» / «Из копилок» у других счетов. Для текущего месяца — по сегодня.
 */
export function accountFlows(input: {
  month: MonthKey;
  today: LocalDate;
  accounts: readonly Account[];
  transactions: readonly Transaction[];
  accountById: ReadonlyMap<Id, Account>;
  categoryById: ReadonlyMap<Id, Category>;
  recurring: readonly Recurring[];
}): { from: LocalDate; to: LocalDate; flows: AccountFlow[] } {
  const { month, today, accounts, transactions, accountById, categoryById, recurring } = input;
  const from = `${month}-01`;
  const to = month === monthOf(today) ? today : endOfMonth(from);
  const recurringById = new Map(recurring.map((r) => [r.id, r]));
  type Acc = { flow: AccountFlow; lines: Map<string, FlowLine>; since: LocalDate };
  const state = new Map<Id, Acc>();
  for (const a of accounts) {
    if (a.type === 'savings' || a.openingDate > to) continue;
    const since = a.openingDate > from ? a.openingDate : from;
    state.set(a.id, { since, lines: new Map(), flow: { account: a, start: a.openingBalance, startDate: since, end: 0, inflow: 0, outflow: 0, lines: [] } });
  }
  const line = (s: Acc, key: string, label: string, amount: Minor, id: Id) => {
    let l = s.lines.get(key);
    if (!l) s.lines.set(key, (l = { key, label, amount: 0, ids: [] }));
    l.amount += amount;
    l.ids.push(id);
  };
  // Одна операция двигает счёт так же, как в computeBalances: до openingDate — не считается.
  const move = (accId: Id | undefined, t: Transaction, delta: Minor, key: string, label: string) => {
    const s = accId ? state.get(accId) : undefined;
    if (!s || t.date < s.flow.account.openingDate || t.date > to) return;
    if (t.date < s.since) {
      s.flow.start += delta; // до начала периода — в остаток на начало
      return;
    }
    if (delta >= 0) s.flow.inflow += delta;
    else s.flow.outflow -= delta;
    line(s, key, label, delta, t.id);
  };
  const name = (id: Id | undefined) => (id && accountById.get(id)?.name) || 'Счёт удалён';
  for (const t of transactions) {
    if (t.type === 'income') {
      const src = (t.recurringId && recurringById.get(t.recurringId)?.name) || (t.categoryId && categoryById.get(t.categoryId)?.name) || 'Доход';
      move(t.accountId, t, t.amount, `inc:${src}`, src);
    } else if (t.type === 'expense') move(t.accountId, t, -t.amount, 'exp', 'Расходы');
    else if (t.type === 'debt') {
      if (t.flow === 'in') move(t.accountId, t, t.amount, 'debtIn', 'Долги: получено');
      else move(t.accountId, t, -t.amount, 'debtOut', 'Долги: отдано');
    } else {
      const dest = t.toAccountId ? accountById.get(t.toAccountId) : undefined;
      const src = accountById.get(t.accountId);
      move(t.accountId, t, -t.amount, dest?.type === 'savings' ? 'toSav' : `to:${t.toAccountId}`, dest?.type === 'savings' ? 'В копилки' : `На ${name(t.toAccountId)}`);
      move(t.toAccountId, t, t.toAmount ?? t.amount, src?.type === 'savings' ? 'fromSav' : `from:${t.accountId}`, src?.type === 'savings' ? 'Из копилок' : `С ${name(t.accountId)}`);
    }
  }
  const flows: AccountFlow[] = [];
  for (const s of state.values()) {
    const f = s.flow;
    f.end = f.start + f.inflow - f.outflow;
    const group = (k: string) => LINE_ORDER.indexOf(k.split(':')[0]!);
    f.lines = [...s.lines.values()].filter((l) => l.amount !== 0).sort((a, b) => group(a.key) - group(b.key) || Math.abs(b.amount) - Math.abs(a.amount));
    // Архивный счёт без движения в периоде не показываем.
    if (f.account.archived && !f.lines.length) continue;
    flows.push(f);
  }
  flows.sort((a, b) => a.account.sortOrder - b.account.sortOrder);
  return { from, to, flows };
}
