import type { Habit, HabitLog, Workout } from './types';

/**
 * Миграция v3 → v4: тренировки убраны из приложения (этап 13).
 * Привычки с «Засчитывать тренировки» получают обычные отметки за дни тренировок — серии и проценты не меняются.
 * Сами тренировки и поле workoutType остаются в базе и бэкапе: ничего не удаляем.
 * id отметки детерминированный — повторный прогон (база, затем импорт того же файла) не плодит дублей.
 */
export function workoutHabitLogs(
  habits: readonly Pick<Habit, 'id' | 'kind' | 'workoutType'>[],
  logs: readonly Pick<HabitLog, 'habitId' | 'date'>[],
  workouts: readonly Pick<Workout, 'date' | 'type' | 'createdAt'>[],
): HabitLog[] {
  const taken = new Set(logs.map((l) => `${l.habitId}|${l.date}`));
  const ordered = [...workouts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
  const out: HabitLog[] = [];
  for (const h of habits) {
    if (!h.workoutType || (h.kind !== 'daily' && h.kind !== 'weekly')) continue;
    for (const w of ordered) {
      if (h.workoutType !== 'any' && w.type !== h.workoutType) continue;
      const key = `${h.id}|${w.date}`;
      if (taken.has(key)) continue;
      taken.add(key);
      out.push({ id: `workout-${h.id}-${w.date}`, habitId: h.id, date: w.date, value: 1, at: w.createdAt });
    }
  }
  return out;
}
