import { describe, expect, it } from 'vitest';
import { velocityOf } from './useSwipeDismiss';
import { dragOffsets, IDLE_MOTION, isHorizontal, listPager, releaseAction, slopped, slotStyle, swipeTarget, TAB_ORDER_CENTER, tabSwipeTarget, wideThreshold, type Pager } from './useTabSwipe';

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

describe('плавность свайпа', () => {
  it('страница трогается с нуля: первые 10 px уходят на распознавание жеста, без рывка', () => {
    expect(slopped(11)).toBe(1);
    expect(slopped(-11)).toBe(-1);
    expect(slopped(-150)).toBe(-140);
    expect(slopped(6)).toBe(0);
    expect(slopped(-10)).toBe(0);
  });

  it('за пальцем — сдвиг в своём слое и без перехода; сосед — на ширину экрана рядом', () => {
    const drag = { tab: -120, pane: 0, live: true, settling: false, snap: false };
    expect(slotStyle('tab', 0, drag)).toEqual({ transform: 'translate3d(-120px, 0, 0)', transition: '', willChange: 'transform' });
    expect(slotStyle('tab', 1, drag).transform).toBe('translate3d(calc(-120px + 100%), 0, 0)');
    expect(slotStyle('tab', -1, { ...drag, tab: 80 }).transform).toBe('translate3d(calc(80px - 100%), 0, 0)');
    expect(slotStyle('pane', 0, drag).transform).toBe('translate3d(0px, 0, 0)');
  });

  it('после отпускания — доезд по кривой iOS; за порогом широкого свайпа панели плавно возвращаются, страница — за пальцем', () => {
    const settling = { tab: -390, pane: 0, live: true, settling: true, snap: false };
    expect(slotStyle('tab', 0, settling).transition).toBe('transform 300ms var(--ease-ios)');
    expect(slotStyle('pane', 0, settling).transition).toBe('transform 300ms var(--ease-ios)');
    const snap = { tab: -24, pane: 0, live: true, settling: false, snap: true };
    expect(slotStyle('pane', 0, snap).transition).toBe('transform 300ms var(--ease-ios)');
    expect(slotStyle('tab', 0, snap).transition).toBe('');
  });

  it('вне жеста — без слоя и перехода, текущая на месте', () => {
    expect(slotStyle('tab', 0, IDLE_MOTION)).toEqual({ transform: 'translateX(0px)', transition: '', willChange: '' });
    expect(slotStyle('pane', 0, IDLE_MOTION)).toEqual({ transform: 'translateX(0px)', transition: '', willChange: '' });
  });
});
