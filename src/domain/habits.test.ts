import { describe, expect, it } from 'vitest';
import { bestStreak, calendarWeeks, currentStreak, habitSummary, habitView, rate30, scheduleLabel, weekOf } from './habits';
import type { Habit, HabitLog } from './types';

const TODAY = '2026-11-04'; // среда
const habit = (extra: Partial<Habit>): Habit => ({
  id: 'h', name: 'Привычка', icon: 'Star', color: '#2448D6', kind: 'daily', startDate: '2026-10-01', sortOrder: 0, archived: false, ...extra,
});
let n = 0;
const log = (date: string, value = 1, habitId = 'h'): HabitLog => ({ id: `l${n++}`, habitId, date, value, at: 0 });

describe('каждый день', () => {
  const logs = ['2026-10-28', '2026-11-01', '2026-11-02', '2026-11-03'].map((d) => log(d));
  it('неотмеченное сегодня не обрывает серию', () => {
    const v = habitView(habit({}), logs, TODAY);
    expect(currentStreak(v, TODAY)).toBe(3);
    expect(habitSummary(v, TODAY)).toBe('Каждый день · серия 3 дня');
  });
  it('отметка сегодня продлевает серию', () => {
    const v = habitView(habit({}), [...logs, log(TODAY)], TODAY);
    expect(currentStreak(v, TODAY)).toBe(4);
  });
  it('пропуск вчера обрывает', () => {
    const v = habitView(habit({ note: '3 литра' }), logs.slice(0, 3), TODAY);
    expect(currentStreak(v, TODAY)).toBe(0);
    expect(habitSummary(v, TODAY)).toBe('Каждый день · 3 литра');
  });
  it('лучшая серия и % за 30 дней', () => {
    const v = habitView(habit({}), logs, TODAY);
    expect(bestStreak(v, TODAY)).toBe(3);
    expect(rate30(v, TODAY)).toBe(13); // 4 из 30
  });
  it('чужие логи и значение 0 галочку не ставят', () => {
    expect(habitView(habit({}), [log(TODAY, 1, 'other')], TODAY).done(TODAY)).toBe(false);
    expect(habitView(habit({}), [log(TODAY, 0)], TODAY).done(TODAY)).toBe(false);
  });
});

describe('по дням недели', () => {
  const gym = habit({ days: [1, 3, 5] }); // пн, ср, пт
  it('серия считает только дни по расписанию, остальные пропускает', () => {
    // пн 26.10, ср 28.10, пт 30.10, пн 02.11 — сегодня среда 04.11 ещё не отмечена
    const logs = ['2026-10-26', '2026-10-28', '2026-10-30', '2026-11-02'].map((d) => log(d));
    const v = habitView(gym, logs, TODAY);
    expect(currentStreak(v, TODAY)).toBe(4);
    expect(habitSummary(v, TODAY)).toBe('Пн, Ср, Пт · серия 4 раза');
    expect(v.state('2026-11-03')).toBe('off'); // вторник — не ждём
    expect(v.state(TODAY)).toBe('missed');
  });
  it('пропущенная пятница обрывает серию', () => {
    const v = habitView(gym, ['2026-10-26', '2026-10-28', '2026-11-02'].map((d) => log(d)), TODAY);
    expect(currentStreak(v, TODAY)).toBe(1);
    expect(bestStreak(v, TODAY)).toBe(2);
  });
  it('галочка вне расписания видна и идёт в процент, но не больше 100', () => {
    const v = habitView(habit({ days: [1], startDate: '2026-11-02' }), [log('2026-11-02'), log('2026-11-03')], TODAY);
    expect(v.state('2026-11-03')).toBe('done');
    expect(rate30(v, TODAY)).toBe(100);
  });
  it('подпись расписания', () => {
    expect(scheduleLabel({ days: [5, 1, 3] })).toBe('Пн, Ср, Пт');
    expect(scheduleLabel({})).toBe('Каждый день');
    expect(scheduleLabel({ days: [1, 2, 3, 4, 5, 6, 7] })).toBe('Каждый день');
  });
});

describe('старое «количество» после v5', () => {
  it('галочка — когда за день набрана прежняя цель', () => {
    const water = habit({ legacyKind: 'count', target: 8, note: '8 стаканов' });
    const v = habitView(water, [log('2026-11-03', 8), log(TODAY, 5)], TODAY);
    expect(v.done('2026-11-03')).toBe(true);
    expect(v.state(TODAY)).toBe('missed');
  });
});

describe('календарь', () => {
  it('неделя пн–вс и 12 недель с понедельника', () => {
    const v = habitView(habit({ startDate: '2026-11-02' }), [log('2026-11-02')], TODAY);
    expect(weekOf(v, TODAY).map((d) => d.state)).toEqual(['done', 'missed', 'missed', 'future', 'future', 'future', 'future']);
    const weeks = calendarWeeks(v, TODAY);
    expect(weeks).toHaveLength(12);
    // Сверху — текущая неделя, ниже — прошлые.
    expect(weeks[0]![0]!.date).toBe('2026-11-02');
    expect(weeks[0]![6]).toEqual({ date: '2026-11-08', state: 'future' });
    expect(weeks[1]![0]!.date).toBe('2026-10-26');
    expect(weeks[11]![0]!.date).toBe('2026-08-17');
  });
});
