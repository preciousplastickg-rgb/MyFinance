import { createContext, useContext, type ReactNode } from 'react';
import { IDLE_VIEW, type PagerView } from './useTabSwipe';

const SectionPagerContext = createContext<PagerView>(IDLE_VIEW);
export const SectionPagerProvider = SectionPagerContext.Provider;

/** false внутри соседней панели (и соседней вкладки): она видна при свайпе, но не «открыта» — не объявляет «+» и т. п. */
export const PaneActiveContext = createContext(true);

/**
 * Листание разделов экрана («Задачи / Привычки / Цели», отчёты — этап 28): при свайпе текущая панель едет за пальцем, рядом
 * из-за края едет соседняя, после отпускания обе доезжают — это жест, а не анимация. Тап по разделу переключает сразу
 * (этап 29: по просьбе пользователя анимированной осталась только смена темы).
 * Панели — по ключу раздела, поэтому соседняя после жеста становится текущей тем же экземпляром.
 */
export function SectionPager<T extends string>({ items, current, render }: { items: readonly T[]; current: T; render: (item: T) => ReactNode }) {
  const v = useContext(SectionPagerContext);
  const parentActive = useContext(PaneActiveContext);
  const neighbor = v.active && v.inner ? items[items.indexOf(current) + v.inner] : undefined;
  const settle = v.settling || v.innerSnap ? 'settle' : '';
  return (
    <div className="relative overflow-x-clip">
      <div key={current} className={settle} style={{ transform: 'translateX(var(--pane-dx, 0px))' }}>
        <PaneActiveContext.Provider value={parentActive}>{render(current)}</PaneActiveContext.Provider>
      </div>
      {neighbor !== undefined && (
        <div
          key={neighbor}
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 ${settle}`}
          style={{ transform: `translateX(calc(var(--pane-dx, 0px) ${v.inner > 0 ? '+' : '-'} 100%))` }}
        >
          <PaneActiveContext.Provider value={false}>{render(neighbor)}</PaneActiveContext.Provider>
        </div>
      )}
    </div>
  );
}
