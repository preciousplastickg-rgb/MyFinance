import { describe, expect, it } from 'vitest';
import { formatAmount, formatMoney, formatRate } from './money';

const NBSP = ' ';

describe('formatAmount', () => {
  it('целые суммы без копеек, тысячи через пробел', () => {
    expect(formatAmount(1_750_000)).toBe(`17${NBSP}500`);
    expect(formatAmount(25_000)).toBe('250');
    expect(formatAmount(0)).toBe('0');
    expect(formatAmount(123_456_789_00)).toBe(`123${NBSP}456${NBSP}789`);
  });
  it('копейки через запятую', () => {
    expect(formatAmount(8_750)).toBe('87,50');
    expect(formatAmount(5)).toBe('0,05');
  });
  it('минус — типографский', () => {
    expect(formatAmount(-25_000)).toBe('−250');
  });
  it('отвергает float', () => {
    expect(() => formatAmount(1.5)).toThrow();
  });
});

describe('formatMoney', () => {
  it('сом и USDT', () => {
    expect(formatMoney(1_750_000, 'KGS')).toBe(`17${NBSP}500${NBSP}сом`);
    expect(formatMoney(20_000, 'USDT')).toBe(`200${NBSP}USDT`);
  });
});

describe('formatRate', () => {
  it('87,50 из 875 000', () => {
    expect(formatRate(875_000)).toBe('87,50');
  });
  it('округляет до сотых', () => {
    expect(formatRate(875_049)).toBe('87,50');
    expect(formatRate(875_050)).toBe('87,51');
    expect(formatRate(10_000_000)).toBe(`1${NBSP}000,00`);
  });
});
