import { PALETTE, type PaletteKey } from './catalog';

/**
 * Цвета категорий, счетов, сфер и привычек до v7 хранились как hex из старой палитры.
 * С редизайном (tokens.css) цвет — имя токена `--c-*`. Незнакомый hex остаётся как есть: colorCss() его понимает.
 */
const LEGACY: Readonly<Record<string, PaletteKey>> = {
  '#2448D6': 'blue',
  '#0B7A4B': 'green',
  '#B45309': 'orange',
  '#6D3FC4': 'violet',
  '#0E7490': 'teal',
  '#BE185D': 'rose',
  '#172554': 'teal',
  '#5B6170': 'slate',
};

export function migrateColor(color: string): string {
  if ((PALETTE as readonly string[]).includes(color)) return color;
  return LEGACY[color.toUpperCase()] ?? color;
}

/** Возвращает только изменившиеся записи — остальные не переписываются. */
export function migrateColors<T extends { color: string }>(rows: readonly T[]): T[] {
  const out: T[] = [];
  for (const row of rows) {
    const color = migrateColor(row.color);
    if (color !== row.color) out.push({ ...row, color });
  }
  return out;
}
