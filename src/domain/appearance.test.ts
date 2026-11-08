import { describe, expect, it } from 'vitest';
import { animationsOf, CENTER_SUBNAV_GAP, CENTER_SUBNAV_HEIGHT, fabPositionOf, navNotchPath, paletteOf, subnavNotchPath, subnavNotchTop } from './appearance';

describe('оформление (этап 26)', () => {
  it('без полей в настройках — графит и «+» слева', () => {
    expect(paletteOf({})).toBe('graphite');
    expect(fabPositionOf({})).toBe('left');
    expect(paletteOf({ palette: 'navy' })).toBe('navy');
    expect(fabPositionOf({ fabPosition: 'center' })).toBe('center');
    // Незнакомое значение из бэкапа более новой версии — умолчание, а не сломанный экран.
    expect(paletteOf({ palette: 'neon' as never })).toBe('graphite');
  });
  it('силуэт меню при W = 358 совпадает с путём из прототипа и SPEC 9a', () => {
    expect(navNotchPath(358)).toBe(
      'M32 0 H119.1 A26 26 0 0 1 144.22 19.29 A36 36 0 0 0 213.78 19.29 A26 26 0 0 1 238.9 0 H326 A32 32 0 0 1 326 64 H32 A32 32 0 0 1 32 0 Z',
    );
  });
  it('вырез всегда по центру ширины', () => {
    for (const W of [375 - 32, 390 - 32, 430 - 32]) {
      const m = navNotchPath(W).match(/^M32 0 H([\d.]+) .* A26 26 0 0 1 ([\d.]+) 0 H([\d.]+)/)!;
      expect(Number(m[1]) + Number(m[2])).toBeCloseTo(W, 1);
      expect(Number(m[3])).toBe(W - 32);
    }
  });
});

describe('панель разделов при «+» по центру — зеркало меню', () => {
  it('вырез снизу по центру ширины, той же окружностью r 36 вокруг кнопки', () => {
    for (const W of [375 - 32, 390 - 32, 430 - 32]) {
      const path = subnavNotchPath(W);
      const m = path.match(/H([\d.]+) A26 26 0 0 1 ([\d.]+) ([\d.]+) A36 36 0 0 0 ([\d.]+) ([\d.]+) A26 26 0 0 1 ([\d.]+) (\d+)/)!;
      const [right, tr, ty, tl, ty2, left, bottom] = m.slice(1).map(Number) as [number, number, number, number, number, number, number];
      expect(right + left).toBeCloseTo(W, 1); // плечи симметричны
      expect(tr + tl).toBeCloseTo(W, 1);
      expect(ty2).toBe(ty);
      expect(bottom).toBe(CENTER_SUBNAV_HEIGHT);
      // Точки касания лежат на окружности выреза: центр кнопки — на gap + 10 ниже нижнего края панели.
      const cy = CENTER_SUBNAV_HEIGHT + CENTER_SUBNAV_GAP + 10;
      expect(Math.hypot(tr - W / 2, ty - cy)).toBeCloseTo(36, 1);
    }
  });
  it('вырез уходит в панель на 26 − зазор и не задевает кнопки разделов (низ на 41 px)', () => {
    expect(subnavNotchTop()).toBe(CENTER_SUBNAV_HEIGHT - (26 - CENTER_SUBNAV_GAP));
    expect(subnavNotchTop()).toBeGreaterThan(41);
  });
});

describe('анимации (этап 29)', () => {
  it('включены, пока их явно не выключили', () => {
    expect(animationsOf({})).toBe(true);
    expect(animationsOf({ animations: true })).toBe(true);
    expect(animationsOf({ animations: false })).toBe(false);
  });
});
