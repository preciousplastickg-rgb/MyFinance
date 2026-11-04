import { describe, expect, it } from 'vitest';
import { formatAmount, formatMoney, formatRate } from './money';
import { inputToMinor, minorToInput, parseMoneyText, plural, pressKey } from './money';

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


describe('своя клавиатура', () => {
  const type = (keys: string[], currency: 'KGS' | 'USDT') => keys.reduce((s, k) => pressKey(s, k, currency), '');
  it('KGS: цифры, 00, стирание', () => {
    expect(type(['2', '5', '0'], 'KGS')).toBe('250');
    expect(type(['1', '7', '5', '00'], 'KGS')).toBe('17500');
    expect(type(['00'], 'KGS')).toBe('');
    expect(type(['2', '5', 'back'], 'KGS')).toBe('2');
    expect(type(['0', '5'], 'KGS')).toBe('5');
  });
  it('KGS: не больше 9 цифр', () => {
    expect(type(Array(12).fill('9'), 'KGS')).toBe('999999999');
    expect(type([...Array(8).fill('1'), '00'], 'KGS')).toBe('11111111');
  });
  it('USDT: запятая вместо 00, два знака', () => {
    expect(type(['1', '2', ',', '5', '0', '7'], 'USDT')).toBe('12,50');
    expect(type([',', '5'], 'USDT')).toBe('0,5');
    expect(type(['1', ',', ','], 'USDT')).toBe('1,');
    expect(type(['1', '00'], 'USDT')).toBe('1');
  });
  it('строка → минимальные единицы и обратно', () => {
    expect(inputToMinor('250')).toBe(25_000);
    expect(inputToMinor('12,5')).toBe(1_250);
    expect(inputToMinor('0,05')).toBe(5);
    expect(inputToMinor('')).toBe(0);
    expect(minorToInput(25_000, 'KGS')).toBe('250');
    expect(minorToInput(1_250, 'USDT')).toBe('12,5');
    expect(minorToInput(20_000, 'USDT')).toBe('200');
  });
});

describe('parseMoneyText', () => {
  it('понимает пробелы, запятую и точку', () => {
    expect(parseMoneyText('17 500')).toBe(1_750_000);
    expect(parseMoneyText('17 500')).toBe(1_750_000);
    expect(parseMoneyText('87,50')).toBe(8_750);
    expect(parseMoneyText('87.5')).toBe(8_750);
    expect(parseMoneyText('-1 200')).toBe(-120_000);
    expect(parseMoneyText('')).toBeNull();
    expect(parseMoneyText('abc')).toBeNull();
  });
});

describe('plural', () => {
  it('день/дня/дней', () => {
    const f = ['день', 'дня', 'дней'] as const;
    expect([1, 2, 5, 11, 21, 22, 25, 111, 0].map((n) => plural(n, f))).toEqual(['день', 'дня', 'дней', 'дней', 'день', 'дня', 'дней', 'дней', 'дней']);
  });
});
