import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSwipeDismiss } from '../app/useSwipeDismiss';

/** Bottom sheet: свой вместо системных alert/confirm. Закрывается фоном, крестиком, Escape и свайпом — вниз за шапку или вправо. */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  full = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  full?: boolean;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const swipe = useSwipeDismiss(onClose, { down: true });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="sheet-backdrop absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        {...swipe.handlers}
        style={swipe.style}
        className={`sheet-panel pb-safe relative flex w-full max-w-lg touch-pan-y flex-col rounded-t-card bg-surface outline-none ${
          full ? 'h-[92dvh]' : 'max-h-[92dvh]'
        }`}
      >
        {/* Шапка — за неё окно тянется вниз. */}
        <div data-sheet-grab className="relative flex touch-none items-center justify-between gap-2 px-4 pt-3 pb-1">
          <span className="absolute top-1.5 left-1/2 h-1 w-9 -translate-x-1/2 rounded-[2px] bg-line" aria-hidden />
          <h2 id={titleId} className="text-h2 font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-2 flex size-11 items-center justify-center rounded-ctl text-muted active:bg-line"
          >
            <X size={22} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
