import { describe, expect, it } from 'vitest';
import { habitView, weekCount } from './habits';
import type { Habit, HabitLog, Workout } from './types';
import { workoutHabitLogs } from './workoutMigration';

const habit = (extra: Partial<Habit>): Habit => ({
  id: 'gym', name: 'Спортзал', icon: 'Dumbbell', color: '#2448D6', kind: 'weekly', target: 3, startDate: '2026-10-01',
  sortOrder: 0, archived: false, ...extra,
});
const workout = (date: string, type: Workout['type'], createdAt = 1): Workout => ({ id: date + type, date, type, createdAt, updatedAt: createdAt });

describe('тренировки → отметки привычек (v3 → v4)', () => {
  const workouts = [workout('2026-11-02', 'gym'), workout('2026-11-02', 'gym', 2), workout('2026-11-03', 'pool'), workout('2026-11-04', 'gym')];

  it('день тренировки нужного типа становится отметкой — неделя засчитана так же, как раньше', () => {
    const gym = habit({ workoutType: 'gym' });
    const logs = workoutHabitLogs([gym], [], workouts);
    expect(logs.map((l) => l.date)).toEqual(['2026-11-02', '2026-11-04']); // две тренировки 2-го — одна отметка
    expect(logs[0]).toEqual({ id: 'workout-gym-2026-11-02', habitId: 'gym', date: '2026-11-02', value: 1, at: 1 });
    expect(weekCount(habitView(gym, logs, '2026-11-04'), '2026-11-04')).toBe(2);
  });

  it('«любая» берёт и зал, и бассейн; уже отмеченный вручную день не дублируется', () => {
    const any = habit({ id: 'sport', workoutType: 'any', kind: 'daily' });
    const manual: HabitLog[] = [{ id: 'm', habitId: 'sport', date: '2026-11-03', value: 1, at: 5 }];
    expect(workoutHabitLogs([any], manual, workouts).map((l) => l.date)).toEqual(['2026-11-02', '2026-11-04']);
  });

  it('привычки без опции, «количество» и «дни без…» не трогаются', () => {
    const habits = [habit({ id: 'a' }), habit({ id: 'b', kind: 'count', workoutType: 'gym' }), habit({ id: 'c', kind: 'abstain', workoutType: 'gym' })];
    expect(workoutHabitLogs(habits, [], workouts)).toEqual([]);
  });
});
