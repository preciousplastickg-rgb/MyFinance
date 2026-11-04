import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Заголовок блока на «Сегодня»: вся строка от края до края — одна кнопка,
 * её легко достать большим пальцем и левой, и правой руки. Справа — подпись-ссылка, как раньше.
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
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-ctl px-1 text-left active:bg-line"
      >
        <span>{title}</span>
        <span className="flex shrink-0 items-center gap-0.5 text-caption font-medium text-accent">
          {right}
          {icon}
        </span>
      </button>
    </h2>
  );
}
