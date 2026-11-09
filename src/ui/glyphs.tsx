import { createElement, type CSSProperties, type ReactElement } from 'react';
import { BOLD, DUOTONE, FILL, type GlyphShape } from './glyphs.gen';

/**
 * Значки интерфейса — Phosphor (этап 29, вместо lucide-react). Имена экспортов прежние, как были у lucide,
 * поэтому экраны не переписывались: `ChevronRight` рисует Phosphor `CaretRight` и т. д.
 * Данные значков — в glyphs.gen.ts (npm run glyphs), только нужные начертания.
 */
export interface GlyphProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Как у lucide: принимается ради совместимости вызовов, толщину задаёт начертание. */
  strokeWidth?: number;
  'aria-hidden'?: boolean | 'true' | 'false';
  'aria-label'?: string;
}

export type GlyphIcon = (props: GlyphProps) => ReactElement;

export function GlyphSvg({ shapes, size = 24, className, style, 'aria-hidden': hidden, 'aria-label': label }: GlyphProps & { shapes: readonly GlyphShape[] }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden={label ? undefined : (hidden ?? true)}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
    >
      {shapes.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}

function glyph(set: Readonly<Record<string, readonly GlyphShape[]>>, name: string): GlyphIcon {
  const shapes = set[name];
  if (!shapes) throw new Error(`Нет значка ${name} в glyphs.gen.ts — добавьте в scripts/gen-glyphs.mjs`);
  const Icon = ({ strokeWidth: _s, ...props }: GlyphProps) => <GlyphSvg shapes={shapes} {...props} />;
  Icon.displayName = name;
  return Icon;
}

// Интерфейс — bold
export const ArrowRight = glyph(BOLD, 'ArrowRight');
export const Check = glyph(BOLD, 'Check');
export const ChevronDown = glyph(BOLD, 'CaretDown');
export const ChevronLeft = glyph(BOLD, 'CaretLeft');
export const ChevronRight = glyph(BOLD, 'CaretRight');
export const Delete = glyph(BOLD, 'Backspace');
export const Ellipsis = glyph(BOLD, 'DotsThree');
export const GripVertical = glyph(BOLD, 'DotsSixVertical');
export const HandCoins = glyph(BOLD, 'HandCoins');
export const MessageSquare = glyph(BOLD, 'ChatText');
export const Minus = glyph(BOLD, 'Minus');
export const Pencil = glyph(BOLD, 'PencilSimple');
export const PiggyBank = glyph(BOLD, 'PiggyBank');
export const Plus = glyph(BOLD, 'Plus');
export const RefreshCw = glyph(BOLD, 'ArrowsClockwise');
export const Repeat = glyph(BOLD, 'Repeat');
export const Search = glyph(BOLD, 'MagnifyingGlass');
export const X = glyph(BOLD, 'X');
export const Trash = glyph(BOLD, 'Trash');
export const CalendarBlank = glyph(BOLD, 'CalendarBlank');
export const CalendarDays = glyph(BOLD, 'CalendarDots');
export const Coins = glyph(BOLD, 'Coins');
export const CreditCard = glyph(BOLD, 'CreditCard');
export const Sparkle = glyph(BOLD, 'Sparkle');

// Меню и шапки — duotone
export const NavToday = glyph(DUOTONE, 'CalendarDots');
export const Wallet = glyph(DUOTONE, 'Wallet');
export const ListChecks = glyph(DUOTONE, 'ListChecks');
export const Target = glyph(DUOTONE, 'Target');
export const ChartPie = glyph(DUOTONE, 'ChartPieSlice');
export const Settings = glyph(DUOTONE, 'Gear');
export const Moon = glyph(DUOTONE, 'Moon');
export const Sun = glyph(DUOTONE, 'Sun');
export const ShieldAlert = glyph(DUOTONE, 'ShieldWarning');
export const Smiley = glyph(DUOTONE, 'Smiley');
/** «Скрыть суммы» в шапке (по просьбе пользователя): глаз — суммы видны, перечёркнутый — скрыты. */
export const Eye = glyph(DUOTONE, 'Eye');
export const EyeSlash = glyph(DUOTONE, 'EyeSlash');

// Залитые
export const Flag = glyph(FILL, 'Flag');
export const CheckCircle2 = glyph(FILL, 'CheckCircle');
