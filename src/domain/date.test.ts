import { describe, expect, it } from 'vitest';
import { formatDayHeader, formatMonthTitle, parseLocalDate, toLocalDate, weekdayOf } from './date';

describe('toLocalDate', () => {
  it('берёт дату по Бишкеку (UTC+6), а не по UTC', () => {
    // 3 ноября 20:30 UTC = 4 ноября 02:30 в Бишкеке
    expect(toLocalDate(Date.UTC(2026, 10, 3, 20, 30))).toBe('2026-11-04');
    // 4 ноября 17:59 UTC = 4 ноября 23:59 в Бишкеке
    expect(toLocalDate(Date.UTC(2026, 10, 4, 17, 59))).toBe('2026-11-04');
    // 4 ноября 18:00 UTC = 5 ноября 00:00 в Бишкеке
    expect(toLocalDate(Date.UTC(2026, 10, 4, 18, 0))).toBe('2026-11-05');
  });

  it('принимает Date', () => {
    expect(toLocalDate(new Date('2026-01-01T00:00:00+06:00'))).toBe('2026-01-01');
  });
});

describe('parseLocalDate', () => {
  it('разбирает YYYY-MM-DD', () => {
    expect(parseLocalDate('2026-02-28')).toEqual({ year: 2026, month: 2, day: 28 });
  });
  it('отвергает другой формат', () => {
    expect(() => parseLocalDate('4.11.2026')).toThrow();
  });
});

describe('weekdayOf', () => {
  it('1 = понедельник, 7 = воскресенье', () => {
    expect(weekdayOf('2026-11-02')).toBe(1);
    expect(weekdayOf('2026-11-04')).toBe(3);
    expect(weekdayOf('2026-11-08')).toBe(7);
  });
});

describe('форматирование дат', () => {
  it('шапка «Сегодня»', () => {
    expect(formatDayHeader('2026-11-04')).toBe('Среда, 4 ноября');
    expect(formatDayHeader('2026-03-01')).toBe('Воскресенье, 1 марта');
  });
  it('заголовок месяца', () => {
    expect(formatMonthTitle('2026-10-15')).toBe('Октябрь 2026');
  });
});
