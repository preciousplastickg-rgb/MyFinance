import { describe, expect, it } from 'vitest';
import { fabPositionOf, navNotchPath, paletteOf } from './appearance';

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
