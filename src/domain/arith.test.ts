import { describe, expect, it } from 'vitest';
import { floorDiv, mulDivRound } from './arith';

describe('floorDiv', () => {
  it('округляет вниз, в том числе для отрицательных', () => {
    expect(floorDiv(7, 2)).toBe(3);
    expect(floorDiv(-7, 2)).toBe(-4);
    expect(floorDiv(1_110_000, 6_000)).toBe(185);
  });
  it('отвергает float', () => {
    expect(() => floorDiv(1.5, 2)).toThrow();
  });
});

describe('mulDivRound', () => {
  it('17 500 сом / 200 USDT = курс 87,50 (×10 000)', () => {
    expect(mulDivRound(1_750_000, 10_000, 20_000)).toBe(875_000);
  });
  it('округляет половину от нуля', () => {
    expect(mulDivRound(1, 1, 2)).toBe(1);
    expect(mulDivRound(-1, 1, 2)).toBe(-1);
    expect(mulDivRound(10, 1, 3)).toBe(3);
  });
  it('без переполнения на больших суммах', () => {
    expect(mulDivRound(9_000_000_000_000, 875_000, 10_000)).toBe(787_500_000_000_000);
  });
});
