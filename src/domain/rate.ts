import { mulDivRound } from './arith';
import type { LocalDate, Minor, Rate, Settings, Transaction } from './types';

/** Курс из двух сумм перевода: сом / USDT ×10 000. 17 500 сом за 200 USDT → 875 000 (87,50). */
export function rateFromAmounts(kgs: Minor, usdt: Minor): Rate {
  if (usdt <= 0) throw new Error('Сумма USDT должна быть больше нуля');
  return mulDivRound(kgs, 10_000, usdt);
}

/** USDT → сомы по курсу, с округлением до целого сома: «≈ 17 500 сом», без копеек. */
export function usdtToKgs(usdt: Minor, rate: Rate): Minor {
  return mulDivRound(usdt, rate, 1_000_000) * 100;
}

export interface RatePoint {
  date: LocalDate;
  rate: Rate;
  at: number;
}

/** История курса: переводы между валютами + ручная правка из настроек. Отсортирована по дате. */
export function rateHistory(transactions: readonly Transaction[], settings?: Settings): RatePoint[] {
  const points: RatePoint[] = [];
  for (const t of transactions) {
    if (t.type === 'transfer' && t.rate) points.push({ date: t.date, rate: t.rate, at: t.createdAt });
  }
  if (settings?.lastUsdtRate && settings.lastUsdtRateDate) {
    points.push({ date: settings.lastUsdtRateDate, rate: settings.lastUsdtRate, at: Number.MAX_SAFE_INTEGER });
  }
  return points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.at - b.at));
}

/** Последний курс на дату или раньше; если такого нет — первый более поздний (SPEC 4.2). */
export function rateOn(history: readonly RatePoint[], date: LocalDate): Rate | undefined {
  let found: RatePoint | undefined;
  for (const p of history) {
    if (p.date <= date) found = p;
    else break;
  }
  return (found ?? history[0])?.rate;
}

/** Курс перевода между валютами: всегда «сом за 1 USDT», в какую бы сторону ни шёл перевод. Одна валюта — курса нет. */
export function transferRate(
  from: { currency: 'KGS' | 'USDT'; amount: Minor },
  to: { currency: 'KGS' | 'USDT'; amount: Minor },
): Rate | undefined {
  if (from.currency === to.currency) return undefined;
  const usdt = from.currency === 'USDT' ? from.amount : to.amount;
  const kgs = from.currency === 'KGS' ? from.amount : to.amount;
  return usdt > 0 && kgs > 0 ? rateFromAmounts(kgs, usdt) : undefined;
}

/**
 * После перевода с курсом обновляются lastUsdtRate и lastUsdtRateDate (SPEC 4.2).
 * Перевод задним числом не перетирает более свежий курс.
 */
export function rateUpdateAfter(tx: Transaction, settings: Settings): Pick<Settings, 'lastUsdtRate' | 'lastUsdtRateDate'> | null {
  if (tx.type !== 'transfer' || !tx.rate) return null;
  if (settings.lastUsdtRateDate && settings.lastUsdtRateDate > tx.date) return null;
  return { lastUsdtRate: tx.rate, lastUsdtRateDate: tx.date };
}
