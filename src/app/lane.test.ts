import { describe, expect, it } from 'vitest';
import {
  caughtOffset,
  isHorizontal,
  laneNeighbors,
  laneOffset,
  laneRaw,
  laneOrder,
  laneStep,
  navColumn,
  navFrame,
  pageKey,
  parsePage,
  rubberBand,
  settleCurve,
  settleDuration,
  slopped,
} from './lane';

const W = 390;

describe('лента (SPEC 9b)', () => {
  it('порядок: вкладки и разделы одним рядом', () => {
    expect(laneOrder(false)).toEqual(['today', 'money', 'tasks:tasks', 'tasks:habits', 'goals', 'reports:money', 'reports:tasks', 'reports:habits']);
  });
  it('при «+» по центру «Цели» — раздел «Дел» на том же месте', () => {
    expect(laneOrder(true)[4]).toBe('tasks:goals');
    expect(laneOrder(true)).toHaveLength(8);
  });
  it('страница из навигации и обратно', () => {
    expect(pageKey('tasks', 'habits', 'money')).toBe('tasks:habits');
    expect(pageKey('reports', 'tasks', 'tasks')).toBe('reports:tasks');
    expect(pageKey('money', 'habits', 'tasks')).toBe('money');
    expect(parsePage('reports:habits')).toEqual({ tab: 'reports', mode: 'habits' });
    expect(parsePage('goals')).toEqual({ tab: 'goals' });
  });
  it('соседи; на краях — никого; страницы не из ленты — без соседей', () => {
    const order = laneOrder(false);
    expect(laneNeighbors(order, 'money')).toEqual({ prev: 'today', next: 'tasks:tasks' });
    expect(laneNeighbors(order, 'goals')).toEqual({ prev: 'tasks:habits', next: 'reports:money' });
    expect(laneNeighbors(order, 'today').prev).toBeUndefined();
    expect(laneNeighbors(order, 'reports:habits').next).toBeUndefined();
    expect(laneNeighbors(order, 'tasks:goals')).toEqual({});
  });
});

describe('меню едет за жестом', () => {
  const order = laneOrder(false);
  it('колонки вкладок; при «+» по центру средняя — кнопка, «Цели» — в «Делах»', () => {
    expect(navColumn('goals', false)).toBe(3);
    expect(navColumn('reports', false)).toBe(4);
    expect(navColumn('tasks', true)).toBe(3);
    expect(navColumn('goals', true)).toBe(3);
    expect(navColumn('money', true)).toBe(1);
  });
  it('между вкладками пилюля едет пропорционально, панель разделов появляется по прогрессу', () => {
    const f = navFrame(order, 'money', 0.5, false);
    expect(f.pill).toBe(1.5);
    expect(f.panels).toEqual({ tasks: { presence: 0.5, pos: 0 } });
  });
  it('между разделами пилюля стоит, подсветка в панели едет', () => {
    const f = navFrame(order, 'tasks:tasks', 0.25, false);
    expect(f.pill).toBe(2);
    expect(f.panels).toEqual({ tasks: { presence: 1, pos: 0.25 } });
  });
  it('уход из «Дел» в «Цели»: панель гаснет; из «Целей» в «Отчёты» — панель отчётов приходит', () => {
    expect(navFrame(order, 'tasks:habits', 0.75, false)).toEqual({ pill: 2.75, panels: { tasks: { presence: 0.25, pos: 1 } } });
    expect(navFrame(order, 'goals', 0.4, false)).toEqual({ pill: 3.4, panels: { reports: { presence: 0.4, pos: 0 } } });
  });
  it('при «+» по центру «Цели» → «Отчёты»: сначала уходит одна панель, потом приходит другая; пилюля едет через кнопку', () => {
    const f = navFrame(laneOrder(true), 'tasks:goals', 0.5, true);
    expect(f.pill).toBe(3.5);
    expect(f.panels).toEqual({ tasks: { presence: 0, pos: 2 }, reports: { presence: 0, pos: 0 } });
    expect(navFrame(laneOrder(true), 'tasks:goals', 0.25, true).panels).toEqual({ tasks: { presence: 0.5, pos: 2 }, reports: { presence: 0, pos: 0 } });
    expect(navFrame(laneOrder(true), 'tasks:goals', 0.75, true).panels).toEqual({ tasks: { presence: 0, pos: 2 }, reports: { presence: 0.5, pos: 0 } });
    expect(navFrame(laneOrder(true), 'money', 0.5, true).pill).toBe(2);
  });
  it('назад — к предыдущей; на краю ленты меню стоит', () => {
    expect(navFrame(order, 'reports:money', -0.5, false)).toEqual({ pill: 3.5, panels: { reports: { presence: 0.5, pos: 0 } } });
    expect(navFrame(order, 'today', -0.3, false)).toEqual({ pill: 0, panels: {} });
    expect(navFrame(order, 'reports:habits', 0.3, false)).toEqual({ pill: 4, panels: { reports: { presence: 1, pos: 2 } } });
  });
});

describe('физика жеста', () => {
  it('захват: дальше 10 px и не круче 45°; дуга большим пальцем засчитывается', () => {
    expect(isHorizontal(20, 15)).toBe(true);
    expect(isHorizontal(-20, 19)).toBe(true);
    expect(isHorizontal(20, 25)).toBe(false);
    expect(isHorizontal(9, 0)).toBe(false);
  });
  it('без рывка в момент захвата: первые 10 px не прибавляются', () => {
    expect(slopped(11)).toBe(1);
    expect(slopped(-150)).toBe(-140);
    expect(slopped(-10)).toBe(0);
  });
  it('медленный свайп на 40 % возвращает, на 60 % — переключает', () => {
    expect(laneStep(-0.4 * W, -0.05, W)).toBe(0);
    expect(laneStep(-0.6 * W, 0, W)).toBe(1);
    expect(laneStep(0.6 * W, 0.1, W)).toBe(-1);
  });
  it('быстрый рывок на 20 % переключает; рывок назад отменяет даже на 70 %', () => {
    expect(laneStep(-0.2 * W, -0.5, W)).toBe(1);
    expect(laneStep(0.2 * W, 0.36, W)).toBe(-1);
    expect(laneStep(-0.7 * W, 0.5, W)).toBe(0);
  });
  it('проекция: смещение + скорость × 200 мс дальше половины ширины', () => {
    expect(laneStep(-150, -0.3, W)).toBe(1); // −150 − 60 = −210 > 195
    expect(laneStep(-150, -0.2, W)).toBe(0); // −190
    expect(laneStep(0, -2, W)).toBe(0);
  });
  it('резинка на краях: (1 − 1 / (dx × 0,55 / W + 1)) × W', () => {
    expect(rubberBand(W, W)).toBeCloseTo((1 - 1 / 1.55) * W, 5);
    expect(rubberBand(-100, W)).toBeCloseTo(-(1 - 1 / (55 / W + 1)) * W, 5);
    expect(rubberBand(0, W)).toBe(0);
    expect(Math.abs(rubberBand(-200, W))).toBeLessThan(100);
  });
  it('лента идёт 1:1, не дальше страницы; к краю — резинка', () => {
    expect(laneOffset(-120, W, true, true)).toBe(-120);
    expect(laneOffset(-500, W, true, true)).toBe(-W);
    expect(laneOffset(120, W, false, true)).toBeCloseTo(rubberBand(120, W), 5);
    expect(laneOffset(-120, W, true, false)).toBeCloseTo(rubberBand(-120, W), 5);
  });
  it('пойманная на резинке страница не прыгает: обратное к резинке', () => {
    expect(laneOffset(laneRaw(60, W, false, true), W, false, true)).toBeCloseTo(60, 5);
    expect(laneOffset(laneRaw(-45, W, true, false), W, true, false)).toBeCloseTo(-45, 5);
    expect(laneRaw(-120, W, true, true)).toBe(-120);
  });
  it('доезд: остаток / скорость, от 180 до 360 мс; ехать некуда — 0', () => {
    expect(settleDuration(250, 1)).toBe(250);
    expect(settleDuration(300, 3)).toBe(180);
    expect(settleDuration(300, 0.1)).toBe(360);
    expect(settleDuration(-200, 0)).toBe(360);
    expect(settleDuration(0, 1)).toBe(0);
  });
  it('кривая доезда стартует со скоростью пальца, конец — как у iOS', () => {
    // 250 px за 250 мс при 1 px/мс: наклон 1 — (0,32; 0,32).
    expect(settleCurve(250, 1, 250)).toBe('cubic-bezier(0.32, 0.32, 0, 1)');
    // Быстрый рывок, доезд упёрся в 180 мс: наклон 2,25 — ровно кривая iOS.
    expect(settleCurve(200, 2.5, 180)).toBe('cubic-bezier(0.32, 0.72, 0, 1)');
    // Ещё быстрее: точка уходит влево, чтобы не было «перелёта» за 1.
    expect(settleCurve(100, 5, 180)).toBe('cubic-bezier(0.111, 1, 0, 1)');
    // Палец стоял или шёл назад — спокойный старт без паузы.
    expect(settleCurve(200, 0, 360)).toBe('cubic-bezier(0.32, 0.32, 0, 1)');
    expect(settleCurve(200, -1, 360)).toBe('cubic-bezier(0.32, 0.32, 0, 1)');
  });
  it('касание во время доезда: за половиной — переход засчитан, отсчёт от новой страницы', () => {
    expect(caughtOffset(-300, -W, W)).toEqual({ commit: true, offset: 90 });
    expect(caughtOffset(-150, -W, W)).toEqual({ commit: false, offset: -150 });
    expect(caughtOffset(40, 0, W)).toEqual({ commit: false, offset: 40 });
  });
});
