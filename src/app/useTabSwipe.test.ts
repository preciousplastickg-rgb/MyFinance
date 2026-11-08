import { describe, expect, it } from 'vitest';
import { velocityOf } from './useSwipeDismiss';
import { listPager, shouldPage } from './useTabSwipe';

// Лента (этап 31) — в lane.test.ts. Здесь — то, что осталось окнам: листание типа в «Новой записи» (SPEC 5.2).
describe('листание в окне', () => {
  it('по списку значений; на краях — никуда', () => {
    const log: string[] = [];
    const p = listPager(['expense', 'income', 'transfer'], 'income', (v) => log.push(v));
    expect(p.canGo(1)).toBe(true);
    expect(p.canGo(-1)).toBe(true);
    p.go(1);
    p.go(-1);
    expect(log).toEqual(['transfer', 'expense']);
    expect(listPager(['expense', 'income'], 'income', () => {}).canGo(1)).toBe(false);
  });
  it('переключает дальше 64 px или рывком дальше 30 px в ту же сторону', () => {
    expect(shouldPage(-70, 0)).toBe(true);
    expect(shouldPage(-40, -0.6)).toBe(true);
    expect(shouldPage(-40, 0.6)).toBe(false); // палец уже пошёл обратно
    expect(shouldPage(-40, -0.2)).toBe(false);
    expect(shouldPage(-20, -2)).toBe(false);
  });
});

describe('скорость пальца', () => {
  it('по последним 100 мс, а не по всему жесту', () => {
    const slowThenFlick = [{ t: 0, v: 0 }, { t: 400, v: 10 }, { t: 450, v: 30 }, { t: 500, v: 60 }];
    expect(velocityOf(slowThenFlick, 500)).toBeCloseTo(0.5, 1);
    const stopped = [{ t: 0, v: 0 }, { t: 100, v: 80 }, { t: 300, v: 80 }];
    expect(velocityOf(stopped, 300)).toBe(0);
    expect(velocityOf([], 0)).toBe(0);
  });
  it('у ленты окно 80 мс: старый медленный участок в скорость не попадает', () => {
    const samples = [{ t: 0, v: 0 }, { t: 410, v: -10 }, { t: 430, v: -20 }, { t: 470, v: -60 }, { t: 500, v: -100 }];
    expect(velocityOf(samples, 500, 80)).toBeCloseTo(-90 / 90, 2);
    expect(velocityOf(samples, 500)).toBeCloseTo(-100 / 500, 2);
  });
});
