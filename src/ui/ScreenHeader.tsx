import type { ReactNode } from 'react';

/** Шапка вкладки: подпись 13 --muted, заголовок 28/600, справа — кнопки 44×44 (HANDOFF, «Экраны»). Свайп по шапке всегда листает вкладки (этап 28). */
export function ScreenHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: string; action?: ReactNode }) {
  return (
    <header data-tab-swipe className="pt-safe pr-3 pl-5">
      <div className="flex items-end justify-between gap-1 pt-1 pb-3.5">
        <div className="min-w-0 flex-1">
          {subtitle && <p className="text-caption text-muted">{subtitle}</p>}
          <h1 className="text-h1 font-semibold">{title}</h1>
        </div>
        {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
      </div>
    </header>
  );
}

/** Кнопка-значок в шапке: 44×44, радиус 16. */
export function HeaderButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex size-11 items-center justify-center rounded-ctl text-ink active:bg-sunk">
      {children}
    </button>
  );
}
