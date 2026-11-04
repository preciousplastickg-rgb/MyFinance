import { addDays, diffDays, weekdayOf } from './date';
import { plural } from './money';
import type { Habit, HabitLog, LocalDate } from './types';

export type DayState = 'done' | 'partial' | 'missed' | 'relapse' | 'before' | 'future';

export interface HabitView {
  habit: Habit;
  /** Значение за день: daily/weekly/abstain — 0/1, count — количество. */
  value: (date: LocalDate) => number;
  done: (date: LocalDate) => boolean;
  state: (date: LocalDate) => DayState;
}

export function habitView(habit: Habit, logs: readonly HabitLog[], today?: LocalDate): HabitView {
  const byDate = new Map<LocalDate, number>();
  for (const l of logs) if (l.habitId === habit.id) byDate.set(l.date, (byDate.get(l.date) ?? 0) + l.value);
  const target = habit.kind === 'count' ? Math.max(1, habit.target ?? 1) : 1;

  const value = (date: LocalDate) => {
    if (habit.kind === 'count') return byDate.get(date) ?? 0;
    return byDate.has(date) ? 1 : 0;
  };
  const done = (date: LocalDate) => {
    if (date < habit.startDate) return false;
    if (habit.kind === 'abstain') return !byDate.has(date) && (!today || date <= today);
    return value(date) >= target;
  };
  const state = (date: LocalDate): DayState => {
    if (date < habit.startDate) return 'before';
    if (today && date > today) return 'future';
    if (habit.kind === 'abstain') return byDate.has(date) ? 'relapse' : 'done';
    if (done(date)) return 'done';
    if (habit.kind === 'count' && value(date) > 0) return 'partial';
    return 'missed';
  };
  return { habit, value, done, state };
}

const mondayOf = (date: LocalDate) => addDays(date, 1 - weekdayOf(date));

/** Сколько дней выполнено на неделе (пн–вс) с этой датой. */
export function weekCount(v: HabitView, date: LocalDate): number {
  const monday = mondayOf(date);
  let n = 0;
  for (let i = 0; i < 7; i++) if (v.done(addDays(monday, i))) n++;
  return n;
}

/**
 * Текущая серия. Дни для daily/count, недели с выполненной целью для weekly.
 * Невыполненное «сегодня» (или текущая неделя) серию не обрывает — считаем до вчера (SPEC 7a.1).
 */
export function currentStreak(v: HabitView, today: LocalDate): number {
  const { habit } = v;
  if (habit.kind === 'abstain') return abstainDays(v, today);
  if (habit.kind === 'weekly') {
    const target = habit.target ?? 1;
    let monday = mondayOf(today);
    let n = 0;
    if (weekCount(v, monday) >= target) n++;
    monday = addDays(monday, -7);
    while (monday >= mondayOf(habit.startDate) && weekCount(v, monday) >= target) {
      n++;
      monday = addDays(monday, -7);
    }
    return n;
  }
  let d = v.done(today) ? today : addDays(today, -1);
  let n = 0;
  while (d >= habit.startDate && v.done(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function bestStreak(v: HabitView, today: LocalDate): number {
  const { habit } = v;
  if (habit.kind === 'weekly') {
    const target = habit.target ?? 1;
    let best = 0;
    let run = 0;
    for (let m = mondayOf(habit.startDate); m <= today; m = addDays(m, 7)) {
      run = weekCount(v, m) >= target ? run + 1 : 0;
      best = Math.max(best, run);
    }
    return best;
  }
  let best = 0;
  let run = 0;
  for (let d = habit.startDate; d <= today; d = addDays(d, 1)) {
    run = v.done(d) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** «Дни без…»: сколько полных дней прошло с последнего срыва (или со старта). Срыв сегодня — 0. */
export function abstainDays(v: HabitView, today: LocalDate): number {
  let d = today;
  while (d >= v.habit.startDate) {
    if (v.state(d) === 'relapse') return diffDays(d, today);
    d = addDays(d, -1);
  }
  return diffDays(v.habit.startDate, today);
}

/** Доля выполнения за последние 30 дней (не раньше старта), %. Для weekly — от цели «N раз в неделю». */
export function rate30(v: HabitView, today: LocalDate): number {
  const from = addDays(today, -29) > v.habit.startDate ? addDays(today, -29) : v.habit.startDate;
  const days = diffDays(from, today) + 1;
  if (days <= 0) return 0;
  let done = 0;
  for (let d = from; d <= today; d = addDays(d, 1)) if (v.done(d)) done++;
  if (v.habit.kind === 'weekly') {
    const expected = Math.max(1, Math.round(((v.habit.target ?? 1) * days) / 7));
    return Math.min(100, Math.round((done * 100) / expected));
  }
  return Math.round((done * 100) / days);
}

/** Последние N дней, старые слева. */
export function lastDays(v: HabitView, today: LocalDate, n = 7): { date: LocalDate; state: DayState }[] {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1);
    return { date, state: v.state(date) };
  });
}

/** Календарь за 12 недель: строки — недели (пн–вс), первая — текущая, ниже — всё старше (читается сверху вниз). */
export function calendarWeeks(v: HabitView, today: LocalDate, weeks = 12): { date: LocalDate; state: DayState }[][] {
  const current = mondayOf(today);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(current, -7 * w + d);
      return { date, state: v.state(date) };
    }),
  );
}

const days = (n: number) => `${n} ${plural(n, ['день', 'дня', 'дней'])}`;

/** Подпись прогресса на карточке. */
export function habitSummary(v: HabitView, today: LocalDate): string {
  const { habit } = v;
  if (habit.kind === 'abstain') return `${days(abstainDays(v, today))} без`;
  if (habit.kind === 'count') {
    const s = currentStreak(v, today);
    return `${v.value(today)} / ${habit.target ?? 1}${habit.unit ? ` ${habit.unit}` : ''}${s > 1 ? ` · серия ${days(s)}` : ''}`;
  }
  if (habit.kind === 'weekly') {
    const s = currentStreak(v, today);
    return `${weekCount(v, today)} из ${habit.target ?? 1} на этой неделе${s > 1 ? ` · ${s} ${plural(s, ['неделя', 'недели', 'недель'])} подряд` : ''}`;
  }
  const s = currentStreak(v, today);
  return s > 0 ? `Серия ${days(s)}` : 'Начните серию сегодня';
}

/** Готовые шаблоны в редакторе. */
export const HABIT_TEMPLATES: readonly Pick<Habit, 'name' | 'icon' | 'color' | 'kind' | 'target' | 'unit'>[] = [
  { name: 'Спортзал', icon: 'Dumbbell', color: '#2448D6', kind: 'weekly', target: 3 },
  { name: 'Бассейн', icon: 'Waves', color: '#0E7490', kind: 'weekly', target: 2 },
  { name: 'Вода', icon: 'Droplet', color: '#0E7490', kind: 'count', target: 8, unit: 'стаканов' },
  { name: 'Чтение', icon: 'BookOpen', color: '#6D3FC4', kind: 'count', target: 20, unit: 'страниц' },
  { name: 'Медитация', icon: 'Leaf', color: '#0B7A4B', kind: 'daily' },
  { name: 'Без сахара', icon: 'Ban', color: '#BE185D', kind: 'abstain' },
];
