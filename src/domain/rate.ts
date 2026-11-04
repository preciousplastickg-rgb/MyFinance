import { mulDivRound } from './arith';
import { isBase } from './currency';
import type { Account, Currency, Id, LocalDate, Minor, Rate, Settings, Transaction } from './types';

/** Курс из двух сумм обмена: сом / валюта ×10 000. 17 500 сом за 200 USDT → 875 000 (87,50). */
export function rateFromAmounts(kgs: Minor, foreign: Minor): Rate {
  if (foreign <= 0) throw new Error('Сумма в валюте должна быть больше нуля');
  return mulDivRound(kgs, 10_000, foreign);
}

/** Валюта → сомы по курсу, с округлением до целого сома: «≈ 17 500 сом», без копеек. */
export function toKgs(amount: Minor, rate: Rate): Minor {
  return mulDivRound(amount, rate, 1_000_000) * 100;
}

/** Кросс-курс для обмена двух валют без сома: сколько `to` за 1 `from`, ×10 000. */
export function crossRate(fromAmount: Minor, toAmount: Minor): Rate | undefined {
  return fromAmount > 0 && toAmount > 0 ? mulDivRound(toAmount, 10_000, fromAmount) : undefined;
}

export interface RatePoint {
  date: LocalDate;
  rate: Rate;
  at: number;
}

/** История курсов по валютам. */
export type RateBook = ReadonlyMap<Currency, RatePoint[]>;

/** Курс, сохранённый в настройках (с учётом формата до v3, где был только USDT). */
export function savedRate(settings: Settings | undefined, currency: Currency): { rate: Rate; date: LocalDate } | undefined {
  const entry = settings?.rates?.[currency];
  if (entry) return entry;
  if (currency === 'USDT' && settings?.lastUsdtRate && settings.lastUsdtRateDate) {
    return { rate: settings.lastUsdtRate, date: settings.lastUsdtRateDate };
  }
  return undefined;
}

/** Иностранная валюта перевода валюта ↔ сом; для остальных переводов — undefined. */
export function foreignSide(tx: Transaction, accountById: ReadonlyMap<Id, Account>): Currency | undefined {
  if (tx.type !== 'transfer' || !tx.toAccountId) return undefined;
  const a = accountById.get(tx.accountId)?.currency;
  const b = accountById.get(tx.toAccountId)?.currency;
  if (!a || !b || a === b) return undefined;
  if (isBase(a)) return b;
  if (isBase(b)) return a;
  return undefined;
}

/** История курсов: обмены валюта ↔ сом + ручная правка из настроек. По каждой валюте — по дате. */
export function rateBook(transactions: readonly Transaction[], accountById: ReadonlyMap<Id, Account>, settings?: Settings): Map<Currency, RatePoint[]> {
  const book = new Map<Currency, RatePoint[]>();
  const push = (c: Currency, p: RatePoint) => book.set(c, [...(book.get(c) ?? []), p]);
  for (const t of transactions) {
    const c = t.rate ? foreignSide(t, accountById) : undefined;
    if (c) push(c, { date: t.date, rate: t.rate!, at: t.createdAt });
  }
  const manual = new Set<Currency>([...Object.keys(settings?.rates ?? {}), ...(settings?.lastUsdtRate ? ['USDT'] : [])]);
  for (const c of manual) {
    const r = savedRate(settings, c);
    if (r) push(c, { date: r.date, rate: r.rate, at: Number.MAX_SAFE_INTEGER });
  }
  for (const list of book.values()) list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.at - b.at));
  return book;
}

/** Последний курс на дату или раньше; если такого нет — первый более поздний (SPEC 4.2). */
export function rateOn(history: readonly RatePoint[] | undefined, date: LocalDate): Rate | undefined {
  if (!history?.length) return undefined;
  let found: RatePoint | undefined;
  for (const p of history) {
    if (p.date <= date) found = p;
    else break;
  }
  return (found ?? history[0])?.rate;
}

/** Курс обмена валюта ↔ сом: всегда «сом за 1 единицу валюты». Одна валюта или две валюты без сома — курса нет. */
export function transferRate(
  from: { currency: Currency; amount: Minor },
  to: { currency: Currency; amount: Minor },
): Rate | undefined {
  if (from.currency === to.currency) return undefined;
  if (!isBase(from.currency) && !isBase(to.currency)) return undefined;
  const foreign = isBase(from.currency) ? to.amount : from.amount;
  const kgs = isBase(from.currency) ? from.amount : to.amount;
  return foreign > 0 && kgs > 0 ? rateFromAmounts(kgs, foreign) : undefined;
}

/**
 * После обмена с курсом обновляется курс этой валюты в настройках (SPEC 4.2, 4.6).
 * Обмен задним числом не перетирает более свежий курс.
 */
export function rateUpdateAfter(tx: Transaction, settings: Settings, accountById: ReadonlyMap<Id, Account>): Pick<Settings, 'rates'> | null {
  const currency = foreignSide(tx, accountById);
  if (!currency || !tx.rate) return null;
  const current = savedRate(settings, currency);
  if (current && current.date > tx.date) return null;
  return { rates: { ...(settings.rates ?? {}), [currency]: { rate: tx.rate, date: tx.date } } };
}
