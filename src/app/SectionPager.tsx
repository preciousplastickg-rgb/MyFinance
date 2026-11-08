import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from 'react';
import { IDLE_VIEW, NO_SLOTS, type PageDir, type PagerSlots, type PagerView, type SlotKind } from './useTabSwipe';

const SectionPagerContext = createContext<PagerView>(IDLE_VIEW);
export const SectionPagerProvider = SectionPagerContext.Provider;

const SlotsContext = createContext<PagerSlots>(NO_SLOTS);
/** Ставит Shell: страницы вкладок и панели разделов внутри сообщают о себе свайпу (useTabSwipe). */
export const PagerSlotsProvider = SlotsContext.Provider;

/** false внутри соседней панели (и соседней вкладки): она видна при свайпе, но не «открыта» — не объявляет «+» и т. п. */
export const PaneActiveContext = createContext(true);

/**
 * Страница или панель, которую двигает свайп. Сдвиг, слой и доезд useTabSwipe пишет прямо в её style (slotStyle) — React их не
 * задаёт, поэтому перерисовка во время жеста ничего не сбрасывает. Сосед (side ≠ 0) скрыт от скринридера.
 */
export function PagerSlot({ kind, side, className, children }: { kind: SlotKind; side: PageDir | 0; className?: string; children: ReactNode }) {
  // Панели внутри соседней вкладки не двигаются — и лишние слои им не нужны. Станет вкладка текущей — панель встанет в строй.
  const all = useContext(SlotsContext);
  const slots = useContext(PaneActiveContext) ? all : NO_SLOTS;
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => slots.attach(ref.current!), [slots]);
  // Соседняя панель после жеста становится текущей тем же элементом — встать на новое место до отрисовки.
  useLayoutEffect(() => slots.place(ref.current!), [slots, side]);
  return (
    <div ref={ref} data-pager={kind} data-side={side} aria-hidden={side ? true : undefined} className={className}>
      {children}
    </div>
  );
}

/**
 * Листание разделов экрана («Задачи / Привычки / Цели», отчёты — этап 28): при свайпе текущая панель едет за пальцем, рядом
 * из-за края едет соседняя, после отпускания обе доезжают — это жест, а не анимация. Тап по разделу переключает сразу
 * (этап 29: по просьбе пользователя анимированной осталась только смена темы).
 * Панели — по ключу раздела, поэтому соседняя после жеста становится текущей тем же экземпляром.
 */
export function SectionPager<T extends string>({ items, current, render }: { items: readonly T[]; current: T; render: (item: T) => ReactNode }) {
  const v = useContext(SectionPagerContext);
  const parentActive = useContext(PaneActiveContext);
  const neighbor = v.inner ? items[items.indexOf(current) + v.inner] : undefined;
  return (
    <div className="relative overflow-x-clip">
      <PagerSlot key={current} kind="pane" side={0}>
        <PaneActiveContext.Provider value={parentActive}>{render(current)}</PaneActiveContext.Provider>
      </PagerSlot>
      {neighbor !== undefined && (
        <PagerSlot key={neighbor} kind="pane" side={v.inner} className="pointer-events-none absolute inset-x-0 top-0">
          <PaneActiveContext.Provider value={false}>{render(neighbor)}</PaneActiveContext.Provider>
        </PagerSlot>
      )}
    </div>
  );
}
