import { currencyInfo, isBase } from './currency';
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
  return currencyInfo(currency).label;
}

/** «17 500 сом», «200 USDT», «150 USD». */
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

const MAX_DIGITS = 9;

/**
 * Состояние своей клавиатуры: строка из цифр и (для валют) одной запятой.
 * Сом — целые сомы, кнопка «00»; остальные валюты — до двух знаков после запятой (SPEC 4.6).
 */
export function pressKey(input: string, key: string, currency: Currency): string {
  const digitsCount = input.replace(',', '').length;
  if (key === 'back') return input.slice(0, -1);
  if (key === ',') {
    if (isBase(currency) || input.includes(',')) return input;
    return (input === '' ? '0' : input) + ',';
  }
  if (key === '00') {
    if (!isBase(currency) || input === '' || input === '0') return input;
    return digitsCount + 2 <= MAX_DIGITS ? input + '00' : input;
  }
  if (!/^\d$/.test(key)) return input;
  const [, cents] = input.split(',');
  if (cents !== undefined && cents.length >= 2) return input;
  if (digitsCount >= MAX_DIGITS) return input;
  if (input === '0') return key;
  return input + key;
}

/** Строка с клавиатуры → минимальные единицы. «250» → 25 000, «12,5» → 1 250. */
export function inputToMinor(input: string): Minor {
  if (input === '') return 0;
  const [whole = '0', cents = ''] = input.split(',');
  return Number(whole || '0') * 100 + Number((cents + '00').slice(0, 2));
}

/** Минимальные единицы → строка для клавиатуры (для правки). */
export function minorToInput(minor: Minor, currency: Currency): string {
  if (minor === 0) return '';
  const whole = Math.floor(Math.abs(minor) / 100);
  const cents = Math.abs(minor) % 100;
  if (isBase(currency) || cents === 0) return String(whole);
  return `${whole},${String(cents).padStart(2, '0').replace(/0$/, '')}`;
}

/** Текстовое поле с системной клавиатурой: «17 500», «-1 200,5», «87.50» → минимальные единицы. */
export function parseMoneyText(text: string): Minor | null {
  const cleaned = text.replace(/[\s ]/g, '').replace('−', '-').replace('.', ',');
  const m = /^(-?)(\d{1,10})(?:,(\d{0,2}))?$/.exec(cleaned);
  if (!m) return null;
  const value = Number(m[2]) * 100 + Number(((m[3] ?? '') + '00').slice(0, 2));
  return m[1] ? -value : value;
}

/** Для текстового поля: 1 750 000 → «17 500», 8 750 → «87,50». */
export function minorToText(minor: Minor): string {
  return formatAmount(minor).replace('−', '-');
}

/** 1 день, 2 дня, 5 дней. */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

/** Курс со всеми четырьмя знаками: 9 950 → «0,9950» — для кросс-курса двух валют (SPEC 4.6). */
export function formatRatePrecise(rate: Rate): string {
  if (!Number.isSafeInteger(rate) || rate < 0) throw new Error(`Некорректный курс: ${rate}`);
  return `${groupThousands(String(Math.floor(rate / 10_000)))},${String(rate % 10_000).padStart(4, '0')}`;
}
