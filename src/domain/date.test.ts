import { describe, expect, it } from 'vitest';
import { formatDayHeader, formatMonthTitle, parseLocalDate, toLocalDate, weekdayOf } from './date';
import { addDays, addMonths, bishkekTime, clampedDate, diffDays, endOfMonth, formatRelativeDate, minutesOfDay, monthPrepositional } from './date';

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


describe('арифметика дат', () => {
  it('addDays через границы месяца и года', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('diffDays', () => {
    expect(diffDays('2026-11-04', '2026-11-10')).toBe(6);
    expect(diffDays('2026-11-10', '2026-11-04')).toBe(-6);
  });
  it('31-е в феврале → 28-е, в високосном → 29-е', () => {
    expect(clampedDate(2027, 2, 31)).toBe('2027-02-28');
    expect(clampedDate(2028, 2, 31)).toBe('2028-02-29');
    expect(clampedDate(2026, 4, 31)).toBe('2026-04-30');
  });
  it('месяцы', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(monthPrepositional('2026-10')).toBe('октябре');
  });
  it('относительные даты', () => {
    expect(formatRelativeDate('2026-11-05', '2026-11-04')).toBe('Завтра');
    expect(formatRelativeDate('2026-11-03', '2026-11-04')).toBe('Вчера');
    expect(formatRelativeDate('2026-11-12', '2026-11-04')).toBe('12 ноября');
  });
});

describe('время по Бишкеку', () => {
  it('17:00 дня поступления и минуты с начала дня', () => {
    const at = bishkekTime('2026-11-10', 17 * 60);
    expect(new Date(at).toISOString()).toBe('2026-11-10T11:00:00.000Z');
    expect(minutesOfDay(at)).toBe(17 * 60);
    expect(toLocalDate(at)).toBe('2026-11-10');
    expect(minutesOfDay(new Date('2026-11-10T18:30:00Z'))).toBe(30); // 00:30 следующего дня в Бишкеке
  });
});
