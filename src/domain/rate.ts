import { mulDivRound } from './arith';
import { BASE_CURRENCY, CURRENCIES, isBase } from './currency';
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
  const push = (c: Currency, p: RatePoint) => {
    const list = book.get(c);
    if (list) list.push(p);
    else book.set(c, [p]);
  };
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
 * После обмена с курсом (и после траты в валюте с новым курсом) обновляется курс этой валюты в настройках (SPEC 4.2, 4.6).
 * Обмен задним числом не перетирает более свежий курс.
 */
export function rateUpdateAfter(tx: Transaction, settings: Settings, accountById: ReadonlyMap<Id, Account>): Pick<Settings, 'rates'> | null {
  const accountCurrency = accountById.get(tx.accountId)?.currency;
  // Трата или доход в валюте (этап 16): курс, введённый вручную, тоже становится последним — следующая трата подставит его сама.
  const flowForeign = tx.type !== 'transfer' && accountCurrency ? foreignOfPayment(tx.origCurrency ?? accountCurrency, accountCurrency) : undefined;
  const currency = tx.type === 'transfer' ? foreignSide(tx, accountById) : flowForeign;
  if (!currency || !tx.rate) return null;
  const current = savedRate(settings, currency);
  if (current && current.date > tx.date) return null;
  if (tx.type !== 'transfer' && current?.rate === tx.rate) return null; // подставленный последний курс — менять нечего
  return { rates: { ...(settings.rates ?? {}), [currency]: { rate: tx.rate, date: tx.date } } };
}

/**
 * Обмен удалён: если курс валюты в настройках взят из него, курсом становится последний из оставшихся обменов.
 * Других обменов нет — курс остаётся как был: лучше старый реальный курс, чем никакого.
 */
export function rateAfterDelete(
  tx: Transaction,
  settings: Settings,
  remaining: readonly Transaction[],
  accountById: ReadonlyMap<Id, Account>,
): Pick<Settings, 'rates'> | null {
  const currency = foreignSide(tx, accountById);
  const current = currency ? savedRate(settings, currency) : undefined;
  if (!currency || !tx.rate || !current || current.rate !== tx.rate || current.date !== tx.date) return null;
  let last: Transaction | undefined;
  for (const t of remaining) {
    if (t.id === tx.id || !t.rate || foreignSide(t, accountById) !== currency) continue;
    if (!last || t.date > last.date || (t.date === last.date && t.createdAt > last.createdAt)) last = t;
  }
  if (!last) return null;
  return { rates: { ...(settings.rates ?? {}), [currency]: { rate: last.rate!, date: last.date } } };
}

/**
 * В какой валюте можно записать трату или доход с этого счёта (этап 16):
 * со счёта в сомах — в любой валюте, с валютного — в его валюте или в сомах.
 */
export function paymentCurrencies(accountCurrency: Currency): Currency[] {
  return isBase(accountCurrency) ? CURRENCIES.map((c) => c.code) : [accountCurrency, BASE_CURRENCY];
}

/** Иностранная валюта пары «валюта платежа — валюта счёта»: та, что не сом. Обе сомы — undefined. */
export function foreignOfPayment(payCurrency: Currency, accountCurrency: Currency): Currency | undefined {
  if (!isBase(payCurrency)) return payCurrency;
  if (!isBase(accountCurrency)) return accountCurrency;
  return undefined;
}

/**
 * Сумма платежа в валюте счёта по курсу «сом за 1 единицу валюты», точно до копейки:
 * 20 USD по 87,50 со счёта в сомах → 1 750,00 сом; 1 750 сом с долларового счёта → 20,00 USD.
 * Две разные иностранные валюты или нет курса — undefined.
 */
export function paymentToAccount(orig: Minor, payCurrency: Currency, accountCurrency: Currency, rate: Rate | undefined): Minor | undefined {
  if (payCurrency === accountCurrency) return orig;
  if (!rate || rate <= 0) return undefined;
  if (isBase(accountCurrency)) return mulDivRound(orig, rate, 10_000);
  if (isBase(payCurrency)) return mulDivRound(orig, 10_000, rate);
  return undefined;
}
