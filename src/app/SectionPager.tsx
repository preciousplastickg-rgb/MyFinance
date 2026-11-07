import { createContext, useContext, type ReactNode } from 'react';
import type { SwipeEnter } from './useTabSwipe';

interface SectionPagerState {
  offset: number;
  enter: SwipeEnter | null;
  settling: boolean;
}

const SectionPagerContext = createContext<SectionPagerState>({ offset: 0, enter: null, settling: false });
export const SectionPagerProvider = SectionPagerContext.Provider;

/**
 * Панель раздела («Задачи / Привычки / Цели», отчёты): при коротком свайпе едет за пальцем, после переключения
 * новая въезжает со стороны жеста — заголовок и сегмент на месте (этап 28, по замечанию «переход очень резкий»).
 */
export function SectionPane({ children }: { children: ReactNode }) {
  const { offset, enter, settling } = useContext(SectionPagerContext);
  return (
    <div
      key={enter?.key}
      className={`${settling && !offset ? 'transition-transform duration-150' : ''} ${enter && !offset ? (enter.from === 1 ? 'tab-enter-right' : 'tab-enter-left') : ''}`}
      style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
    >
      {children}
    </div>
  );
}
