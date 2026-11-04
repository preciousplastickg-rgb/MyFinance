import { describe, expect, it } from 'vitest';
import { abstainDays, bestStreak, calendarWeeks, currentStreak, habitSummary, habitView, lastDays, rate30, weekCount } from './habits';
import type { Habit, HabitLog } from './types';

const TODAY = '2026-11-04'; // среда
const habit = (extra: Partial<Habit>): Habit => ({
  id: 'h', name: 'Привычка', icon: 'Star', color: '#2448D6', kind: 'daily', startDate: '2026-10-01', sortOrder: 0, archived: false, ...extra,
});
let n = 0;
const log = (date: string, value = 1, habitId = 'h'): HabitLog => ({ id: `l${n++}`, habitId, date, value, at: 0 });

describe('да/нет каждый день', () => {
  const logs = ['2026-10-28', '2026-11-01', '2026-11-02', '2026-11-03'].map((d) => log(d));
  it('неотмеченное сегодня не обрывает серию', () => {
    const v = habitView(habit({}), logs, TODAY);
    expect(currentStreak(v, TODAY)).toBe(3);
    expect(habitSummary(v, TODAY)).toBe('Серия 3 дня');
  });
  it('отметка сегодня продлевает серию', () => {
    const v = habitView(habit({}), [...logs, log(TODAY)], TODAY);
    expect(currentStreak(v, TODAY)).toBe(4);
  });
  it('пропуск вчера обрывает', () => {
    const v = habitView(habit({}), logs.slice(0, 3), TODAY);
    expect(currentStreak(v, TODAY)).toBe(0);
    expect(habitSummary(v, TODAY)).toBe('Начните серию сегодня');
  });
  it('лучшая серия и % за 30 дней', () => {
    const v = habitView(habit({}), logs, TODAY);
    expect(bestStreak(v, TODAY)).toBe(3);
    expect(rate30(v, TODAY)).toBe(13); // 4 из 30
  });
  it('чужие логи не учитываются', () => {
    const v = habitView(habit({}), [log(TODAY, 1, 'other')], TODAY);
    expect(v.done(TODAY)).toBe(false);
  });
});

describe('количество за день', () => {
  const water = habit({ kind: 'count', target: 8, unit: 'стаканов' });
  it('«Вода 8 стаканов»: 8 × «+1» засчитывают день (приёмка этапа 9)', () => {
    const plusOnes = Array.from({ length: 8 }, () => log(TODAY));
    const seven = habitView(water, plusOnes.slice(0, 7), TODAY);
    expect(seven.done(TODAY)).toBe(false);
    expect(seven.state(TODAY)).toBe('partial');
    expect(habitSummary(seven, TODAY)).toBe('7 / 8 стаканов');
    const eight = habitView(water, plusOnes, TODAY);
    expect(eight.done(TODAY)).toBe(true);
    expect(eight.state(TODAY)).toBe('done');
  });
});

describe('N раз в неделю', () => {
  const gym = habit({ kind: 'weekly', target: 3 });
  it('прогресс недели пн–вс и серия недель', () => {
    const logs = ['2026-10-19', '2026-10-21', '2026-10-23', '2026-10-26', '2026-10-28', '2026-10-30', '2026-11-02'].map((d) => log(d));
    const v = habitView(gym, logs, TODAY);
    expect(weekCount(v, TODAY)).toBe(1);
    expect(currentStreak(v, TODAY)).toBe(2); // текущая неделя ещё не закрыта — не обрывает
    expect(habitSummary(v, TODAY)).toBe('1 из 3 на этой неделе · 2 недели подряд');
    expect(bestStreak(v, TODAY)).toBe(2);
  });
});

describe('дни без…', () => {
  const noSugar = habit({ kind: 'abstain', startDate: '2026-10-01' });
  it('дни с последнего срыва', () => {
    const v = habitView(noSugar, [log('2026-10-10'), log('2026-10-23')], TODAY);
    expect(abstainDays(v, TODAY)).toBe(12);
    expect(habitSummary(v, TODAY)).toBe('12 дней без');
    expect(bestStreak(v, TODAY)).toBe(12);
  });
  it('без срывов — со старта; срыв сегодня — 0', () => {
    expect(abstainDays(habitView(noSugar, [], TODAY), TODAY)).toBe(34);
    expect(abstainDays(habitView(noSugar, [log(TODAY)], TODAY), TODAY)).toBe(0);
  });
});

describe('календарь', () => {
  it('7 последних дней и 12 недель с понедельника', () => {
    const v = habitView(habit({ startDate: '2026-11-02' }), [log('2026-11-02')], TODAY);
    expect(lastDays(v, TODAY).map((d) => d.state)).toEqual(['before', 'before', 'before', 'before', 'done', 'missed', 'missed']);
    const weeks = calendarWeeks(v, TODAY);
    expect(weeks).toHaveLength(12);
    // Сверху — текущая неделя, ниже — прошлые.
    expect(weeks[0]![0]!.date).toBe('2026-11-02');
    expect(weeks[0]![6]).toEqual({ date: '2026-11-08', state: 'future' });
    expect(weeks[1]![0]!.date).toBe('2026-10-26');
    expect(weeks[11]![0]!.date).toBe('2026-08-17');
  });
});
