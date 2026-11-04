import { describe, expect, it } from 'vitest';
import { describeSchedule } from './recurring';

describe('describeSchedule', () => {
  it('по-русски', () => {
    expect(describeSchedule({ type: 'monthly', day: 10 })).toBe('10-го числа');
    expect(describeSchedule({ type: 'weekly', weekday: 1 })).toBe('по понедельникам');
    expect(describeSchedule({ type: 'yearly', month: 3, day: 1 })).toBe('1 марта каждый год');
  });
});
