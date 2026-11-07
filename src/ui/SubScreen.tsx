import { ChevronLeft } from './glyphs';
import type { ReactNode } from 'react';
import { useNav } from '../app/nav';

/** Экран из стека: «‹ Назад» цветом акцента, заголовок 28/600, действие справа. */
export function SubScreen({
  title,
  subtitle,
  back = 'Назад',
  action,
  hero,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: string;
  action?: ReactNode;
  /** Своя шапка вместо заголовка (кольцо цели с названием). */
  hero?: ReactNode;
  children: ReactNode;
}) {
  const { pop } = useNav();
  return (
    <div className="pb-[calc(env(safe-area-inset-bottom)+40px)]">
      <div className="pt-safe flex items-center justify-between px-2">
        <button type="button" onClick={pop} className="flex min-h-11 items-center gap-0.5 pr-3 pl-1 text-body font-medium text-accent">
          <ChevronLeft size={22} aria-hidden />
          {back}
        </button>
        <div className="pr-1">{action}</div>
      </div>
      {hero ?? (
        <div className="px-5 pt-1 pb-3.5">
          <h1 className="text-h1 font-semibold">{title}</h1>
          {subtitle && <div className="tabular mt-1 text-[14px] text-muted">{subtitle}</div>}
        </div>
      )}
      <div className="space-y-4 px-4">{children}</div>
    </div>
  );
}
