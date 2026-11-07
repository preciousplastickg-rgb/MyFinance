import { createContext, useContext, useState, type ReactNode } from 'react';
import { IDLE_VIEW, type PagerView } from './useTabSwipe';

const SectionPagerContext = createContext<PagerView>(IDLE_VIEW);
export const SectionPagerProvider = SectionPagerContext.Provider;

/** false внутри соседней и уезжающей панели (и соседней вкладки): они видны, но не «открыты» — не объявляют «+» и т. п. */
export const PaneActiveContext = createContext(true);

interface Change<T> {
  item: T;
  /** Номер смены раздела. 0 — первый показ, без анимации. */
  key: number;
  /** Откуда въезжает новая панель: 1 — справа (раздел правее прежнего), −1 — слева. */
  from: 1 | -1;
  /** Прежняя панель, пока уезжает после тапа. */
  leaving: T | null;
  /** Тап по сегменту — въезд анимацией; жест — панель уже на месте (она ехала рядом за пальцем). */
  animate: boolean;
}

/**
 * Листание разделов экрана («Задачи / Привычки / Цели», отчёты — этап 28): текущая панель едет за пальцем, рядом с ней
 * из-за края едет соседняя; после отпускания обе доезжают с того места, где были, — как страницы в iOS.
 *
 * Панели — по ключу раздела, поэтому соседняя после жеста становится текущей тем же экземпляром: ничего не монтируется
 * заново, числа и кольца не анимируются второй раз. Тап по сегменту: новая панель въезжает со стороны своего раздела
 * (правее — справа), прежняя уезжает в другую сторону.
 */
export function SectionPager<T extends string>({ items, current, render }: { items: readonly T[]; current: T; render: (item: T) => ReactNode }) {
  const v = useContext(SectionPagerContext);
  const parentActive = useContext(PaneActiveContext);
  const i = items.indexOf(current);

  // Смена раздела замечается в рендере (состояние подстраивается под проп): новая панель сразу рисуется с анимацией.
  const [change, setChange] = useState<Change<T>>({ item: current, key: 0, from: 1, leaving: null, animate: false });
  if (change.item !== current) {
    setChange({
      item: current,
      key: change.key + 1,
      from: i > items.indexOf(change.item) ? 1 : -1,
      leaving: v.committing ? null : change.item,
      animate: !v.committing,
    });
  } else if (v.active && change.leaving !== null) {
    // Начался жест — уезжающая после тапа панель больше не нужна.
    setChange({ ...change, leaving: null });
  }

  const neighbor = v.active && v.inner ? items[i + v.inner] : undefined;
  const slots = [current, neighbor, change.leaving].filter((x, idx, all): x is T => x != null && all.indexOf(x) === idx);
  const settle = v.settling || v.innerSnap ? 'settle' : '';

  return (
    <div className="relative overflow-x-clip">
      {slots.map((item) => {
        if (item === current) {
          const enter = change.animate && change.key > 0 ? (change.from === 1 ? 'pane-enter-right' : 'pane-enter-left') : '';
          return (
            <div key={item} className={`${settle} ${enter}`} style={{ transform: 'translateX(var(--pane-dx, 0px))' }}>
              <PaneActiveContext.Provider value={parentActive}>{render(item)}</PaneActiveContext.Provider>
            </div>
          );
        }
        if (item === neighbor) {
          return (
            <div
              key={item}
              aria-hidden
              className={`pointer-events-none absolute inset-x-0 top-0 ${settle}`}
              style={{ transform: `translateX(calc(var(--pane-dx, 0px) ${v.inner > 0 ? '+' : '-'} 100%))` }}
            >
              <PaneActiveContext.Provider value={false}>{render(item)}</PaneActiveContext.Provider>
            </div>
          );
        }
        return (
          <div
            key={item}
            aria-hidden
            // Только конец своей анимации: внутри панели есть свои (полоски, кольца) — они не должны снимать её раньше.
            onAnimationEnd={(e) => e.target === e.currentTarget && setChange((c) => ({ ...c, leaving: null }))}
            className={`pointer-events-none absolute inset-x-0 top-0 ${change.from === 1 ? 'pane-leave-left' : 'pane-leave-right'}`}
          >
            <PaneActiveContext.Provider value={false}>{render(item)}</PaneActiveContext.Provider>
          </div>
        );
      })}
    </div>
  );
}
