import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNav } from '../app/nav';

/** Экран из стека: «‹ Назад», заголовок, действие справа. */
export function SubScreen({
  title,
  back = 'Назад',
  action,
  children,
}: {
  title: string;
  back?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { pop } = useNav();
  return (
    <div className="pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <div className="pt-safe flex items-center justify-between px-2">
        <button
          type="button"
          onClick={pop}
          className="mt-2 flex min-h-11 items-center gap-0.5 pr-3 text-body font-medium text-accent"
        >
          <ChevronLeft size={24} aria-hidden />
          {back}
        </button>
        <div className="mt-2">{action}</div>
      </div>
      <h1 className="px-4 pt-1 pb-4 text-h1 font-bold">{title}</h1>
      <div className="space-y-4 px-4">{children}</div>
    </div>
  );
}
