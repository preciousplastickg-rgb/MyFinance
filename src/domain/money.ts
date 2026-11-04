import type { Currency, Minor, Rate } from './types';

const NBSP = ' ';
const MINUS = '−';

function assertInteger(value: number, what: string): void {
  if (!Number.isSafeInteger(value)) throw new Error(`${what} должно быть целым: ${value}`);
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Сумма в минимальных единицах (×100) → «17 500», «87,50», «−250». Копейки только если не ноль. */
export function formatAmount(minor: Minor): string {
  assertInteger(minor, 'Сумма');
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  const text = groupThousands(String(whole)) + (cents ? `,${String(cents).padStart(2, '0')}` : '');
  return minor < 0 ? MINUS + text : text;
}

export function currencyLabel(currency: Currency): string {
  return currency === 'KGS' ? 'сом' : 'USDT';
}

/** «17 500 сом», «200 USDT». */
export function formatMoney(minor: Minor, currency: Currency): string {
  return `${formatAmount(minor)}${NBSP}${currencyLabel(currency)}`;
}

/** Курс ×10 000 → «87,50» (всегда два знака, округление половины вверх). */
export function formatRate(rate: Rate): string {
  assertInteger(rate, 'Курс');
  if (rate < 0) throw new Error(`Курс не может быть отрицательным: ${rate}`);
  const hundredths = Math.floor((rate + 50) / 100);
  const whole = Math.floor(hundredths / 100);
  const cents = hundredths % 100;
  return `${groupThousands(String(whole))},${String(cents).padStart(2, '0')}`;
}
