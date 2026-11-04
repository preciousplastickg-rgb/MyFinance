import { addDays } from './date';
import type { Habit, HabitLog, LocalDate } from './types';

/** «N раз в неделю» → конкретные дни недели (1 = пн). Пользователь поправит в редакторе. */
export const WEEKLY_DAYS: Record<number, number[]> = {
  1: [1],
  2: [2, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
};

/**
 * Миграция v4 → v5 (этап 14): все привычки — просто галочка за день, с расписанием по дням недели.
 * Ничего не удаляем:
 * - «N раз в неделю» получает дни (3 → пн, ср, пт); 7 раз — каждый день.
 * - «Количество» — галочка; записи остаются, день засчитан, если сумма ≥ старой цели (legacyKind 'count').
 *   Цель уходит в подпись: «8 стаканов».
 * - «Дни без…» — галочка = день без срыва: каждый день от старта до today без срыва получает отметку,
 *   а запись срыва остаётся со значением 0 (не выполнено).
 * id новых отметок детерминированный — повторный прогон не плодит дублей.
 */
export function migrateHabitsV5(
  habits: readonly Habit[],
  logs: readonly HabitLog[],
  today: LocalDate,
  at: number,
): { habits: Habit[]; changedLogs: HabitLog[]; addedLogs: HabitLog[] } {
  const out: Habit[] = [];
  const changedLogs: HabitLog[] = [];
  const addedLogs: HabitLog[] = [];
  const ids = new Set(logs.map((l) => l.id));
  for (const h of habits) {
    if (h.kind === 'daily') {
      out.push(h);
      continue;
    }
    const next: Habit = { ...h, kind: 'daily', legacyKind: h.kind };
    if (h.kind === 'weekly') {
      const days = WEEKLY_DAYS[h.target ?? 7];
      if (days) next.days = days;
    }
    if (h.kind === 'count' && !h.note) {
      next.note = `${h.target ?? 1} ${h.unit?.trim() || 'за день'}`;
    }
    if (h.kind === 'abstain') {
      const relapses = new Set<LocalDate>();
      for (const l of logs) {
        if (l.habitId !== h.id) continue;
        relapses.add(l.date);
        if (l.value !== 0) changedLogs.push({ ...l, value: 0 });
      }
      for (let d = h.startDate; d <= today; d = addDays(d, 1)) {
        const id = `abstain-${h.id}-${d}`;
        if (relapses.has(d) || ids.has(id)) continue;
        addedLogs.push({ id, habitId: h.id, date: d, value: 1, at });
      }
    }
    out.push(next);
  }
  return { habits: out, changedLogs, addedLogs };
}
