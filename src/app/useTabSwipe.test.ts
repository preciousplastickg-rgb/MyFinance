import { describe, expect, it } from 'vitest';
import { velocityOf } from './useSwipeDismiss';
import { dragOffsets, isHorizontal, listPager, releaseAction, swipeTarget, TAB_ORDER_CENTER, tabSwipeTarget, wideThreshold, type Pager } from './useTabSwipe';

describe('свайп между вкладками', () => {
  it('влево — следующая, вправо — предыдущая, на краях — никуда', () => {
    expect(swipeTarget('today', -100)).toBe('money');
    expect(swipeTarget('money', -100)).toBe('tasks');
    expect(swipeTarget('tasks', 100)).toBe('money');
    expect(swipeTarget('today', 100)).toBeNull();
    expect(swipeTarget('reports', -100)).toBeNull();
  });
  it('при «+» по центру «Цели» в свайпе пропускаются: Дела → Отчёты', () => {
    expect(swipeTarget('tasks', -100, TAB_ORDER_CENTER)).toBe('reports');
    expect(swipeTarget('reports', 100, TAB_ORDER_CENTER)).toBe('tasks');
    expect(tabSwipeTarget('tasks', -70, 0, TAB_ORDER_CENTER)).toBe('reports');
  });
  it('жест по дуге до 45° — горизонтальный; круче — прокрутка; короче 10 px — ещё не решено', () => {
    expect(isHorizontal(20, 15)).toBe(true);
    expect(isHorizontal(-20, 19)).toBe(true);
    expect(isHorizontal(20, 25)).toBe(false);
    expect(isHorizontal(8, 0)).toBe(false);
  });
  it('переключает дальше 64 px или рывком дальше 30 px в ту же сторону', () => {
    expect(tabSwipeTarget('money', -70, 0)).toBe('tasks');
    expect(tabSwipeTarget('money', -40, -0.6)).toBe('tasks');
    expect(tabSwipeTarget('money', -40, 0.6)).toBeNull(); // палец уже пошёл обратно
    expect(tabSwipeTarget('money', -40, -0.2)).toBeNull();
    expect(tabSwipeTarget('money', -20, -2)).toBeNull();
  });
  it('скорость — по последним 100 мс, а не по всему жесту', () => {
    const slowThenFlick = [{ t: 0, v: 0 }, { t: 400, v: 10 }, { t: 450, v: 30 }, { t: 500, v: 60 }];
    expect(velocityOf(slowThenFlick, 500)).toBeCloseTo(0.5, 1);
    const stopped = [{ t: 0, v: 0 }, { t: 100, v: 80 }, { t: 300, v: 80 }];
    expect(velocityOf(stopped, 300)).toBe(0);
    expect(velocityOf([], 0)).toBe(0);
  });

  it('разделы листаются по списку; вкладка из «Дел» — широким свайпом (45 % ширины), с края раздела — обычным', () => {
    const log: string[] = [];
    const p = listPager(['tasks', 'habits', 'goals'], 'habits', (v) => log.push(v));
    expect(p.canGo(1)).toBe(true);
    expect(p.canGo(-1)).toBe(true);
    p.go(1);
    p.go(-1);
    expect(log).toEqual(['goals', 'tasks']);
    const edge = listPager(['tasks', 'habits'], 'habits', () => {});
    expect(edge.canGo(1)).toBe(false);
    expect(wideThreshold(390)).toBe(176);
    expect(wideThreshold(375)).toBe(169);
  });
});

describe('свайп вкладок как разделов (этап 29)', () => {
  const pager = (prev: boolean, next: boolean): Pager => ({ canGo: (d) => (d === 1 ? next : prev), go: () => {} });
  const base = { width: 390, tabOnly: false };

  it('страница едет за пальцем 1:1, рядом — соседняя вкладка с той стороны, куда листаем', () => {
    expect(dragOffsets(-120, { ...base, outer: pager(true, true), inner: null })).toEqual({ tab: -120, pane: 0, outer: 1, inner: 0, snap: false });
    expect(dragOffsets(80, { ...base, outer: pager(true, true), inner: null })).toEqual({ tab: 80, pane: 0, outer: -1, inner: 0, snap: false });
  });
  it('на краю меню — сопротивление и без соседа', () => {
    expect(dragOffsets(80, { ...base, outer: pager(false, true), inner: null })).toEqual({ tab: 20, pane: 0, outer: 0, inner: 0, snap: false });
  });
  it('в «Делах»: до порога едет панель раздела, за порогом — страница от порога, панели возвращаются', () => {
    const inner = pager(true, true);
    expect(dragOffsets(-100, { ...base, outer: pager(true, true), inner })).toEqual({ tab: 0, pane: -100, outer: 0, inner: 1, snap: false });
    expect(dragOffsets(-200, { ...base, outer: pager(true, true), inner })).toEqual({ tab: -24, pane: 0, outer: 1, inner: 1, snap: true });
    // Свайп по шапке — всегда страница.
    expect(dragOffsets(-100, { ...base, tabOnly: true, outer: pager(true, true), inner })).toEqual({ tab: -100, pane: 0, outer: 1, inner: 0, snap: false });
  });
  it('чем кончится жест: раздел, вкладка (широкий или с края раздела), возврат', () => {
    const outer = pager(true, true);
    expect(releaseAction(-100, 0, { ...base, outer, inner: pager(true, true) })).toBe('inner');
    expect(releaseAction(-200, 0, { ...base, outer, inner: pager(true, true) })).toBe('outer');
    expect(releaseAction(-100, 0, { ...base, outer, inner: pager(true, false) })).toBe('outer');
    expect(releaseAction(-40, 0, { ...base, outer, inner: pager(true, true) })).toBe('back');
    expect(releaseAction(-100, 0, { ...base, outer: pager(true, false), inner: null })).toBe('back');
  });
});
