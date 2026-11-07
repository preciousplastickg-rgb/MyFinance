import type { Settings } from './types';

/** Этап 26 (SPEC 9a): тема (палитра), режим и место кнопки «+». */
export type Palette = 'graphite' | 'navy' | 'espresso';
export type FabPosition = 'left' | 'center' | 'right';

export const PALETTES: readonly Palette[] = ['graphite', 'navy', 'espresso'];
export const FAB_POSITIONS: readonly FabPosition[] = ['left', 'center', 'right'];

export const DEFAULT_PALETTE: Palette = 'graphite';
/** Слева — выбор пользователя (под большой палец левой руки). */
export const DEFAULT_FAB_POSITION: FabPosition = 'left';

export const PALETTE_NAMES: Record<Palette, string> = { graphite: 'Графит', navy: 'Синий', espresso: 'Эспрессо' };
export const FAB_NAMES: Record<FabPosition, string> = { left: 'Слева', center: 'По центру', right: 'Справа' };
export const FAB_HINTS: Record<FabPosition, string> = {
  left: 'Слева — под большой палец левой руки',
  center: 'По центру «+» встаёт между вкладками, «Цели» переезжают в «Дела» третьей вкладкой',
  right: 'Справа — под большой палец правой руки',
};

/**
 * Цвет строки состояния (meta theme-color) = --bg темы, светлая / тёмная. Единственные hex вне tokens.css:
 * inline-скрипт в index.html ставит его до загрузки CSS, когда токены взять неоткуда. Та же таблица — в index.html.
 */
export const THEME_COLORS: Record<Palette, { light: string; dark: string }> = {
  graphite: { light: '#f4f6f8', dark: '#0c0d10' },
  navy: { light: '#f2f6fc', dark: '#080e15' },
  espresso: { light: '#faf5f0', dark: '#130c06' },
};

export const paletteOf = (s: Pick<Settings, 'palette'>): Palette => (s.palette && PALETTES.includes(s.palette) ? s.palette : DEFAULT_PALETTE);
/** Анимации включены, пока их явно не выключили (этап 29). */
export const animationsOf = (s: Pick<Settings, 'animations'>): boolean => s.animations !== false;
export const fabPositionOf = (s: Pick<Settings, 'fabPosition'>): FabPosition =>
  s.fabPosition && FAB_POSITIONS.includes(s.fabPosition) ? s.fabPosition : DEFAULT_FAB_POSITION;

/** Высота пилюли меню и кнопки «+» по центру (SPEC 9a). */
export const NAV_HEIGHT = 64;
export const CENTER_FAB_SIZE = 60;
/** Центр кнопки — на 10 px ниже верхнего края пилюли. */
export const CENTER_FAB_CY = 10;

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Силуэт пилюли с вырезом под кнопку «+» по центру (SPEC 9a): кнопка 60, вырез-окружность r 36 (зазор 6),
 * плечи — дуги r 26, касательные к верхнему краю и к окружности выреза. Для W = 358 даёт путь из прототипа.
 */
export function navNotchPath(width: number): string {
  const W = r2(width);
  const cx = W / 2;
  // Центр плеча на высоте 26; расстояние до центра выреза (cx, 10) равно 26 + 36 = 62 → x по Пифагору.
  const shoulder = Math.sqrt(62 * 62 - 16 * 16); // 59.90
  // Точка касания — на линии центров, в 26 от центра плеча.
  const tx = shoulder - (shoulder * 26) / 62; // 34.78
  const ty = 26 - (16 * 26) / 62; // 19.29
  const n = (v: number) => String(r2(v));
  return [
    `M32 0 H${n(cx - shoulder)}`,
    `A26 26 0 0 1 ${n(cx - tx)} ${n(ty)}`,
    `A36 36 0 0 0 ${n(cx + tx)} ${n(ty)}`,
    `A26 26 0 0 1 ${n(cx + shoulder)} 0`,
    `H${n(W - 32)} A32 32 0 0 1 ${n(W - 32)} 64 H32 A32 32 0 0 1 32 0 Z`,
  ].join(' ');
}
