import { describe, expect, it } from 'vitest';
import { velocityOf } from './useSwipeDismiss';
import { chainPagers, isHorizontal, listPager, swipeTarget, TAB_ORDER_CENTER, tabSwipeTarget } from './useTabSwipe';

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

  it('вложенное листание: сначала разделы «Дел», с края — соседняя вкладка (этап 28)', () => {
    const log: string[] = [];
    const inner = listPager(['tasks', 'habits', 'goals'], 'habits', (v) => log.push(`mode:${v}`));
    const outer = listPager(['money', 'tasks', 'reports'], 'tasks', (v) => log.push(`tab:${v}`));
    const both = chainPagers(inner, outer);
    both.go(1);
    both.go(-1);
    expect(log).toEqual(['mode:goals', 'mode:tasks']);
    const edge = chainPagers(listPager(['tasks', 'habits', 'goals'], 'goals', (v) => log.push(`mode:${v}`)), outer);
    edge.go(1);
    expect(log.at(-1)).toBe('tab:reports');
    expect(edge.canGo(1)).toBe(true);
    // На самом краю обоих — никуда: сопротивление.
    const last = chainPagers(listPager(['a', 'b'], 'b', () => {}), listPager(['x', 'y'], 'y', () => {}));
    expect(last.canGo(1)).toBe(false);
    expect(last.canGo(-1)).toBe(true);
    expect(chainPagers(null, outer).canGo(-1)).toBe(true);
  });
});
