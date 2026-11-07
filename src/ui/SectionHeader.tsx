import { ChevronRight } from './glyphs';
import type { ReactNode } from 'react';

/**
 * Заголовок блока на «Сегодня»: 17/600, справа подпись 13 --muted и шеврон; вся строка — одна кнопка 44 px,
 * её легко достать большим пальцем и левой, и правой руки.
 */
export function SectionHeader({
  title,
  right,
  onClick,
  expanded,
  label,
  icon = <ChevronRight size={16} aria-hidden />,
}: {
  title: string;
  right?: ReactNode;
  onClick: () => void;
  /** Для сворачиваемого блока — состояние для экранного диктора. */
  expanded?: boolean;
  label?: string;
  icon?: ReactNode;
}) {
  return (
    <h2 className="text-h2 font-semibold">
      <button
        type="button"
        onClick={onClick}
        aria-expanded={expanded}
        aria-label={label}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-1 text-left"
      >
        <span>{title}</span>
        <span className="tabular flex shrink-0 items-center gap-2 text-caption font-normal text-muted">
          {right}
          {icon}
        </span>
      </button>
    </h2>
  );
}
