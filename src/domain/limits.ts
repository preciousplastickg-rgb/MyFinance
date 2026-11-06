import { floorDiv } from './arith';
import { daysInMonth, monthOf, parseLocalDate, type MonthKey } from './date';
import { formatAmount, plural } from './money';
import { type RateBook } from './rate';
import { expensesByCategory } from './reports';
import type { Account, Category, Id, LocalDate, Minor, Transaction } from './types';

/** Лимит по категории за месяц (этап 23, SPEC 4.9). */
export interface CategoryLimitView {
  category: Category;
  limit: Minor;
  /** Потрачено за месяц в сомах (валютные траты — по курсу операции). */
  spent: Minor;
  count: number;
  approx: boolean;
  /** limit − spent; отрицательный — перерасход. */
  left: Minor;
  /** Доля потраченного 0–100, целое, для полосы. */
  percent: number;
  /** near — потрачено ≥ 80%; over — лимит исчерпан или превышен. */
  status: 'ok' | 'near' | 'over';
  /** Текущий месяц и остаток > 0: сколько можно в день до конца месяца, до сома. */
  perDay?: Minor;
}

export const NEAR_PERCENT = 80;

export interface LimitsInput {
  month: MonthKey;
  today: LocalDate;
  transactions: readonly Transaction[];
  categories: readonly Category[];
  accountById: ReadonlyMap<Id, Account>;
  rates: RateBook;
}

/** Есть ли лимит у категории: только расход, не в архиве, лимит > 0. */
export function hasLimit(c: Category): c is Category & { limit: Minor } {
  return c.kind === 'expense' && !c.archived && (c.limit ?? 0) > 0;
}

/** Лимиты за месяц по всем категориям с лимитом; сначала самые заполненные. */
export function categoryLimits(input: LimitsInput): CategoryLimitView[] {
  const limited = input.categories.filter(hasLimit);
  if (!limited.length) return [];
  const byCat = expensesByCategory(input.transactions, input.month, input.accountById, input.rates);
  const current = input.month === monthOf(input.today);
  const { year, month, day } = parseLocalDate(input.today);
  const daysLeft = current ? daysInMonth(year, month) - day + 1 : 0;
  const out = limited.map((category) => {
    const v = byCat.get(category.id) ?? { total: 0, count: 0, approx: false };
    const left = category.limit - v.total;
    const percent = Math.min(100, floorDiv(v.total * 100, category.limit));
    const status: CategoryLimitView['status'] = left <= 0 ? 'over' : percent >= NEAR_PERCENT ? 'near' : 'ok';
    const view: CategoryLimitView = { category, limit: category.limit, spent: v.total, count: v.count, approx: v.approx, left, percent, status };
    if (current && left > 0) view.perDay = floorDiv(left, daysLeft * 100) * 100;
    return view;
  });
  return out.sort((a, b) => b.percent - a.percent || a.category.sortOrder - b.category.sortOrder);
}

/** Подпись к заголовку блока: «всё в рамках», «1 превышен», «2 на грани». */
export function limitsSummary(views: readonly CategoryLimitView[]): { over: number; near: number; text: string } {
  const over = views.filter((v) => v.status === 'over').length;
  const near = views.filter((v) => v.status === 'near').length;
  const text = over
    ? `${over} ${plural(over, ['превышен', 'превышены', 'превышено'])}`
    : near
      ? `${near} на грани`
      : 'всё в рамках';
  return { over, near, text };
}

/** Строка под полосой: «осталось 1 800 · по 85 в день» или «перерасход 400». */
export function limitCaption(v: CategoryLimitView): { text: string; warn: boolean } {
  if (v.left < 0) return { text: `перерасход ${formatAmount(-v.left)}`, warn: true };
  if (v.left === 0) return { text: 'лимит исчерпан', warn: true };
  const perDay = v.perDay !== undefined && v.perDay > 0 ? ` · по ${formatAmount(v.perDay)} в день` : '';
  return { text: `осталось ${formatAmount(v.left)}${perDay}`, warn: v.status === 'near' };
}

/**
 * Подсказка в форме записи под выбранной категорией. extra — сумма новой траты в сомах (0 — ещё не набрана):
 * «Осталось 1 800 из 6 000», «Останется 1 550 из 6 000», «Превысит лимит 6 000 на 400».
 */
export function limitHint(v: Pick<CategoryLimitView, 'limit' | 'spent'>, extra: Minor): { text: string; warn: boolean } {
  const after = v.spent + extra;
  const left = v.limit - after;
  const nearAfter = left * 100 <= v.limit * (100 - NEAR_PERCENT);
  if (extra > 0) {
    if (left < 0) return { text: `Превысит лимит ${formatAmount(v.limit)} на ${formatAmount(-left)}`, warn: true };
    if (left === 0) return { text: `Лимит ${formatAmount(v.limit)} будет исчерпан`, warn: true };
    return { text: `Останется ${formatAmount(left)} из ${formatAmount(v.limit)}`, warn: nearAfter };
  }
  if (left < 0) return { text: `Лимит ${formatAmount(v.limit)} превышен на ${formatAmount(-left)}`, warn: true };
  if (left === 0) return { text: `Лимит ${formatAmount(v.limit)} исчерпан`, warn: true };
  return { text: `Осталось ${formatAmount(left)} из ${formatAmount(v.limit)}`, warn: nearAfter };
}
