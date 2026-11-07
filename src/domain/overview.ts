import { floorDiv } from './arith';
import { isBase } from './currency';
import { addDays } from './date';
import { debtsOverview, totalKgs } from './debts';
import { toKgs } from './rate';
import { expectedKgs, type DailyLimit, type Occurrence } from './recurring';
import { isSavings } from './savings';
import type { Account, Currency, Debt, Id, LocalDate, Minor, Rate, Transaction } from './types';

/** Сколько дней вперёд считаются «платежи дальше» и сколько назад — средний дневной расход. */
export const OVERVIEW_DAYS = 30;

export interface MoneyOverviewInput {
  today: LocalDate;
  accounts: readonly Account[];
  balances: ReadonlyMap<Id, Minor>;
  transactions: readonly Transaction[];
  occurrences: readonly Occurrence[];
  debts: readonly Debt[];
  /** Лимит на день — отсюда горизонт поступления и дата зарплаты. */
  limit: Pick<DailyLimit, 'horizon'>;
  rateFor: (currency: Currency) => Rate | undefined;
}

export interface MoneyOverview {
  /** Все активные счета, включая копилки и валюту по курсу, ≈ в сомах. */
  total: Minor;
  /** Повседневные счета (без копилок): сомовые и валютные по курсу. */
  everyday: Minor;
  /** Сомовые повседневные счета. */
  kgs: Minor;
  /** Валютные повседневные счета ≈ в сомах. */
  foreign: Minor;
  /** Копилки ≈ в сомах. */
  savings: Minor;
  /** Есть валюта, пересчитанная по курсу. */
  approx: boolean;
  /** Валюты с ненулевым остатком без курса — в итог не вошли. */
  missing: Currency[];
  /** Неоплаченные платежи, просроченные и до поступления, — со всех счетов, обязательные и нет. */
  dueNow: Minor;
  dueNowItems: Occurrence[];
  /** Платежи от поступления до `today + 30` включительно. */
  dueLater: Minor;
  dueLaterItems: Occurrence[];
  /** Последний день окна «дальше». */
  laterUntil: LocalDate;
  /** Открытые долги: я должен / мне должны, ≈ в сомах. */
  iOwe: Minor;
  owedToMe: Minor;
  /** dueNow + dueLater + iOwe. */
  obligations: Minor;
  /** everyday − obligations: что действительно свободно. Может быть отрицательным. */
  free: Minor;
  /** Средний дневной расход за 30 дней без регулярных платежей, с повседневных счетов. */
  avgDaily: Minor;
  /** На сколько дней обычных трат хватит свободных денег; нет среднего или свободных — undefined. */
  runwayDays?: number;
}

/**
 * Остаток и обязательства для карточки «Сегодня» (SPEC 4.10, этап 24).
 * В отличие от лимита на день (4.4) здесь считаются все счета и все платежи, не только «в лимите» и обязательные:
 * вопрос карточки — «сколько у меня денег и сколько из них уже обещано», а не «сколько тратить сегодня».
 */
export function moneyOverview(input: MoneyOverviewInput): MoneyOverview {
  const { today, accounts, balances, transactions, occurrences, debts, rateFor } = input;
  const horizon = input.limit.horizon;
  const laterUntil = addDays(today, OVERVIEW_DAYS);

  let kgs = 0;
  let foreign = 0;
  let savings = 0;
  let approx = false;
  const missing = new Set<Currency>();
  const everydayAccount = new Map<Id, Account>();
  for (const a of accounts) {
    if (a.archived) continue;
    const b = balances.get(a.id) ?? 0;
    let v = b;
    if (!isBase(a.currency)) {
      const r = rateFor(a.currency);
      if (!r) {
        if (b !== 0) missing.add(a.currency);
        continue;
      }
      v = toKgs(b, r);
      approx = true;
    }
    if (isSavings(a)) savings += v;
    else {
      everydayAccount.set(a.id, a);
      if (isBase(a.currency)) kgs += v;
      else foreign += v;
    }
  }
  const everyday = kgs + foreign;
  const total = everyday + savings;

  const pending = occurrences.filter((o) => o.recurring.kind === 'expense' && o.status === 'pending');
  const dueNowItems = pending.filter((o) => o.dueDate < horizon || o.dueDate <= today);
  const dueLaterItems = pending.filter((o) => o.dueDate >= horizon && o.dueDate > today && o.dueDate <= laterUntil);
  const sum = (items: Occurrence[]) => items.reduce((s, o) => s + expectedKgs(o.recurring, rateFor), 0);
  const dueNow = sum(dueNowItems);
  const dueLater = sum(dueLaterItems);

  const d = debtsOverview(debts, transactions, today);
  const iOwe = totalKgs(d.totals.iOwe, rateFor);
  const owedToMe = totalKgs(d.totals.owedToMe, rateFor);

  const obligations = dueNow + dueLater + iOwe;
  const free = everyday - obligations;

  const since = addDays(today, -(OVERVIEW_DAYS - 1));
  let spent = 0;
  for (const t of transactions) {
    const a = everydayAccount.get(t.accountId);
    if (!a || t.type !== 'expense' || t.recurringId || t.date < since || t.date > today) continue;
    if (isBase(a.currency)) spent += t.amount;
    else {
      const r = rateFor(a.currency);
      if (r) spent += toKgs(t.amount, r);
    }
  }
  const avgDaily = floorDiv(spent, OVERVIEW_DAYS);
  const runwayDays = avgDaily > 0 && free > 0 ? floorDiv(free, avgDaily) : undefined;

  return {
    total, everyday, kgs, foreign, savings, approx, missing: [...missing],
    dueNow, dueNowItems, dueLater, dueLaterItems, laterUntil, iOwe, owedToMe, obligations, free, avgDaily, runwayDays,
  };
}

export interface CurrencyTotal {
  currency: Currency;
  /** Сумма на всех активных счетах в этой валюте, включая копилки. */
  amount: Minor;
  /** ≈ в сомах по последнему курсу; нет курса или сом — нет. */
  kgs?: Minor;
}

/**
 * «Сколько у меня в разных валютах» для карточки «Остаток» (этап 29): по каждой валюте — сумма всех активных счетов,
 * копилки включительно. Валюты с нулём не показываются. Сом первым, дальше — по величине в сомах.
 */
export function currencyTotals(accounts: readonly Account[], balances: ReadonlyMap<Id, Minor>, rateFor: (currency: Currency) => Rate | undefined): CurrencyTotal[] {
  const by = new Map<Currency, Minor>();
  for (const a of accounts) {
    if (a.archived) continue;
    by.set(a.currency, (by.get(a.currency) ?? 0) + (balances.get(a.id) ?? 0));
  }
  const out: CurrencyTotal[] = [];
  for (const [currency, amount] of by) {
    if (amount === 0) continue;
    const rate = isBase(currency) ? undefined : rateFor(currency);
    out.push({ currency, amount, ...(rate ? { kgs: toKgs(amount, rate) } : {}) });
  }
  return out.sort((a, b) => (isBase(a.currency) ? -1 : isBase(b.currency) ? 1 : (b.kgs ?? 0) - (a.kgs ?? 0) || a.currency.localeCompare(b.currency)));
}
