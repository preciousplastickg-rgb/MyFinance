import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { SwipeEnter } from './useTabSwipe';

interface SectionPagerState {
  /** Смещение панели за пальцем, px (1:1). */
  offset: number;
  enter: SwipeEnter | null;
  settling: boolean;
}

const SectionPagerContext = createContext<SectionPagerState>({ offset: 0, enter: null, settling: false });
export const SectionPagerProvider = SectionPagerContext.Provider;

/** false внутри соседней и уезжающей панели: они видны, но не «открыты» — не объявляют действие «+» и т. п. */
export const PaneActiveContext = createContext(true);

const SETTLE = 'transition-transform duration-200 ease-out';

/**
 * Листание разделов экрана («Задачи / Привычки / Цели», отчёты — этап 28): текущая панель едет за пальцем, рядом с ней
 * из-за края едет соседняя; после переключения новая доезжает до места, старая уезжает — как страницы в iOS.
 * Заголовок и сегмент остаются на месте.
 */
export function SectionPager<T extends string>({ items, current, render }: { items: readonly T[]; current: T; render: (item: T) => ReactNode }) {
  const { offset, enter, settling } = useContext(SectionPagerContext);
  const i = items.indexOf(current);
  const neighbor = offset ? items[i + (offset < 0 ? 1 : -1)] : undefined;

  // Старая панель после переключения: уезжает в сторону, противоположную жесту, и снимается по концу анимации.
  const prev = useRef(current);
  const [leaving, setLeaving] = useState<{ item: T; key: number; from: 1 | -1 } | null>(null);
  useEffect(() => {
    if (prev.current !== current) {
      if (enter) setLeaving({ item: prev.current, key: enter.key, from: enter.from });
      prev.current = current;
    }
  }, [current, enter]);

  return (
    <div className="relative overflow-x-clip">
      <div
        key={enter?.key}
        className={`${settling && !offset ? SETTLE : ''} ${enter && !offset ? (enter.from === 1 ? 'pane-enter-right' : 'pane-enter-left') : ''}`}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
      >
        {render(current)}
      </div>
      {neighbor !== undefined && (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 ${settling ? SETTLE : ''}`}
          style={{ transform: `translateX(calc(${offset}px ${offset < 0 ? '+' : '-'} 100%))` }}
        >
          <PaneActiveContext.Provider value={false}>{render(neighbor)}</PaneActiveContext.Provider>
        </div>
      )}
      {leaving && !offset && (
        <div
          key={leaving.key}
          aria-hidden
          onAnimationEnd={() => setLeaving(null)}
          className={`pointer-events-none absolute inset-x-0 top-0 ${leaving.from === 1 ? 'pane-leave-left' : 'pane-leave-right'}`}
        >
          <PaneActiveContext.Provider value={false}>{render(leaving.item)}</PaneActiveContext.Provider>
        </div>
      )}
    </div>
  );
}
