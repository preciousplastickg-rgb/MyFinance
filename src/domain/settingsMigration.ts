import type { Settings } from './types';

/** Миграция настроек v2 → v3 (SPEC 4.6): lastUsdtRate → rates.USDT. Старые поля остаются — ничего не удаляем. */
export function migrateSettingsV3<T extends Partial<Settings>>(s: T): T {
  if (!s.lastUsdtRate || !s.lastUsdtRateDate || s.rates?.USDT) return s;
  return { ...s, rates: { ...(s.rates ?? {}), USDT: { rate: s.lastUsdtRate, date: s.lastUsdtRateDate } } };
}
