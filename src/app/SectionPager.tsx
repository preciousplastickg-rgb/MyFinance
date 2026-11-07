import { createContext, useContext, useState, type ReactNode } from 'react';

interface SectionPagerState {
  /** Смещение панели за пальцем, px (1:1). */
  offset: number;
  settling: boolean;
}

const SectionPagerContext = createContext<SectionPagerState>({ offset: 0, settling: false });
export const SectionPagerProvider = SectionPagerContext.Provider;

/** false внутри соседней и уезжающей панели: они видны, но не «открыты» — не объявляют действие «+» и т. п. */
export const PaneActiveContext = createContext(true);

const SETTLE = 'transition-transform duration-200 ease-out';

interface Change<T> {
  item: T;
  /** Номер смены раздела — ключ панели: новая монтируется заново и проигрывает въезд. 0 — первый показ, без анимации. */
  key: number;
  /** Откуда въезжает новая панель: 1 — справа (раздел правее прежнего), −1 — слева. */
  from: 1 | -1;
  /** Прежняя панель, пока уезжает. */
  leaving: T | null;
}

/**
 * Листание разделов экрана («Задачи / Привычки / Цели», отчёты — этап 28): текущая панель едет за пальцем, рядом с ней
 * из-за края едет соседняя; после переключения новая доезжает до места, старая уезжает — как страницы в iOS.
 * Заголовок и сегмент остаются на месте.
 *
 * Направление — по расположению разделов: новый правее прежнего въезжает справа, а прежний уезжает влево, и наоборот.
 * Так одинаково ведут себя тап по сегменту и свайп (свайп влево ведёт к правому соседу). Раньше направление брали
 * из состояния жеста, которое не сбрасывалось: тап без свайпа не анимировался, а после свайпа уезжал в сторону прошлого жеста.
 */
export function SectionPager<T extends string>({ items, current, render }: { items: readonly T[]; current: T; render: (item: T) => ReactNode }) {
  const { offset, settling } = useContext(SectionPagerContext);
  const i = items.indexOf(current);
  const neighbor = offset ? items[i + (offset < 0 ? 1 : -1)] : undefined;

  // Смена раздела замечается прямо в рендере (состояние подстраивается под проп): панель перерисовывается уже с анимацией,
  // без кадра «новая панель на месте, а потом прыгнула к краю».
  const [change, setChange] = useState<Change<T>>({ item: current, key: 0, from: 1, leaving: null });
  if (change.item !== current) {
    setChange({ item: current, key: change.key + 1, from: i > items.indexOf(change.item) ? 1 : -1, leaving: change.item });
  }
  const entering = change.key > 0 && !offset;

  return (
    <div className="relative overflow-x-clip">
      <div
        key={change.key}
        className={`${settling && !offset ? SETTLE : ''} ${entering ? (change.from === 1 ? 'pane-enter-right' : 'pane-enter-left') : ''}`}
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
      {change.leaving !== null && !offset && (
        <div
          key={`leave-${change.key}`}
          aria-hidden
          // Только конец своей анимации: внутри панели есть свои (полоски копилок, кольца) — они не должны снимать её раньше.
          onAnimationEnd={(e) => e.target === e.currentTarget && setChange((c) => ({ ...c, leaving: null }))}
          className={`pointer-events-none absolute inset-x-0 top-0 ${change.from === 1 ? 'pane-leave-left' : 'pane-leave-right'}`}
        >
          <PaneActiveContext.Provider value={false}>{render(change.leaving)}</PaneActiveContext.Provider>
        </div>
      )}
    </div>
  );
}
