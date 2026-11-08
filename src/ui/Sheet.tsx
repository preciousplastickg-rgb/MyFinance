import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSwipeDismiss } from '../app/useSwipeDismiss';
import { X } from './glyphs';

/**
 * Bottom sheet: свой вместо системных alert/confirm. Закрывается фоном, крестиком, Escape и свайпом — вниз из любого места,
 * пока содержимое не прокручено, или вправо; при свайпе фон светлеет вместе с окном. Появляется и закрывается кнопками сразу,
 * без анимации (этап 29: анимированной осталась только смена темы).
 * Страницу под окном не прокручивает touch-action: none на корне (внутренняя область прокручивается сама, overscroll-contain
 * не даёт прокрутке «утечь» на страницу). body.overflow не трогаем: на iOS после его снятия страница иногда переставала прокручиваться.
 * У внутренней области touch-action: pan-y — иначе iOS отдаёт ей и горизонтальный жест, и свайп вправо «закрыть» теряется.
 * Слой z-50 — тот же, что у полноэкранного редактора записи: кто смонтирован позже, тот сверху. Так шторка курса
 * из редактора лежит над ним, а редактор, открытый из шторки («Из чего лимит»), — над ней.
 */
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
  const swipe = useSwipeDismiss(onClose, { down: true });
  // onClose почти всегда inline-функция: эффект ниже ставится один раз, свежая функция — из ref.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    swipe.ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex touch-none items-end justify-center">
      <div ref={swipe.backdropRef} className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={swipe.ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        {...swipe.handlers}
        className={`pb-safe relative flex w-full max-w-lg touch-pan-y flex-col rounded-t-[28px] bg-surface outline-none ${
          full ? 'h-[92dvh]' : 'max-h-[92dvh]'
        }`}
      >
        {/* Шапка — за неё окно тянется вниз всегда, даже если содержимое прокручено. */}
        <div data-sheet-grab className="relative flex touch-none items-center justify-between gap-2 px-4 pt-3 pb-1">
          <span className="absolute top-2 left-1/2 h-[5px] w-9 -translate-x-1/2 rounded-[3px] bg-line" aria-hidden />
          <h2 id={titleId} className="pt-2 text-[20px] font-semibold">
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
        <div data-sheet-scroll className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 pb-[18px]">{children}</div>
        {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
