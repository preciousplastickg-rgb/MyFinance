import type { Currency } from './types';

export const BASE_CURRENCY: Currency = 'KGS';

export interface CurrencyInfo {
  code: Currency;
  label: string; // как пишется после суммы
  name: string;
}

/** Валюты счетов (SPEC 4.6). У всех два знака после запятой (×100). */
export const CURRENCIES: readonly CurrencyInfo[] = [
  { code: 'KGS', label: 'сом', name: 'Кыргызский сом' },
  { code: 'USD', label: 'USD', name: 'Доллар США' },
  { code: 'EUR', label: 'EUR', name: 'Евро' },
  { code: 'USDT', label: 'USDT', name: 'Tether (USDT)' },
  { code: 'RUB', label: 'RUB', name: 'Российский рубль' },
  { code: 'KZT', label: 'KZT', name: 'Казахстанский тенге' },
  { code: 'CNY', label: 'CNY', name: 'Китайский юань' },
  { code: 'TRY', label: 'TRY', name: 'Турецкая лира' },
  { code: 'GBP', label: 'GBP', name: 'Фунт стерлингов' },
];

export function isBase(currency: Currency): boolean {
  return currency === BASE_CURRENCY;
}

export function currencyInfo(code: Currency): CurrencyInfo {
  return CURRENCIES.find((c) => c.code === code) ?? { code, label: code, name: code };
}
