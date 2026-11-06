import { addDays, weekdayOf } from './date';
import { plural } from './money';
import type { Habit, HabitLog, Id, LocalDate } from './types';

/** done — галочка; missed — день по расписанию без галочки; off — не по расписанию; before/future — недоступно. */
export type DayState = 'done' | 'missed' | 'off' | 'before' | 'future';

export interface HabitView {
  habit: Habit;
  done: (date: LocalDate) => boolean;
  /** Ждём ли привычку в этот день по расписанию. */
  scheduled: (date: LocalDate) => boolean;
  state: (date: LocalDate) => DayState;
}

const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Сколько за день нужно, чтобы галочка стояла: 1, у старых «количественных» — прежняя цель (данные до v5). */
export function habitThreshold(habit: Habit): number {
  return habit.legacyKind === 'count' ? Math.max(1, habit.target ?? 1) : 1;
}

export function isEveryDay(habit: Pick<Habit, 'days'>): boolean {
  return !habit.days?.length || habit.days.length === 7;
}

function viewOf(habit: Habit, byDate: ReadonlyMap<LocalDate, number>, today?: LocalDate): HabitView {
  const threshold = habitThreshold(habit);
  const days = isEveryDay(habit) ? null : new Set(habit.days);

  const done = (date: LocalDate) => date >= habit.startDate && (byDate.get(date) ?? 0) >= threshold;
  const scheduled = (date: LocalDate) => date >= habit.startDate && (!days || days.has(weekdayOf(date)));
  const state = (date: LocalDate): DayState => {
    if (date < habit.startDate) return 'before';
    if (today && date > today) return 'future';
    if (done(date)) return 'done';
    return scheduled(date) ? 'missed' : 'off';
  };
  return { habit, done, scheduled, state };
}

export function habitView(habit: Habit, logs: readonly HabitLog[], today?: LocalDate): HabitView {
  const byDate = new Map<LocalDate, number>();
  for (const l of logs) if (l.habitId === habit.id) byDate.set(l.date, (byDate.get(l.date) ?? 0) + l.value);
  return viewOf(habit, byDate, today);
}

/** Все привычки разом: отметки раскладываются по привычкам за один проход, а не проходом по всем отметкам на каждую. */
export function habitViews(habits: readonly Habit[], logs: readonly HabitLog[], today?: LocalDate): HabitView[] {
  const totals = new Map<Id, Map<LocalDate, number>>();
  for (const l of logs) {
    let byDate = totals.get(l.habitId);
    if (!byDate) {
      byDate = new Map();
      totals.set(l.habitId, byDate);
    }
    byDate.set(l.date, (byDate.get(l.date) ?? 0) + l.value);
  }
  const none = new Map<LocalDate, number>();
  return habits.map((h) => viewOf(h, totals.get(h.id) ?? none, today));
}

const mondayOf = (date: LocalDate) => addDays(date, 1 - weekdayOf(date));

/**
 * Текущая серия: сколько дней по расписанию подряд выполнено. Дни вне расписания пропускаются.
 * Невыполненное «сегодня» серию не обрывает — считаем до вчера (SPEC 7a.1).
 */
export function currentStreak(v: HabitView, today: LocalDate): number {
  let d = today;
  if (!v.done(today)) d = addDays(today, -1);
  let n = 0;
  for (; d >= v.habit.startDate; d = addDays(d, -1)) {
    if (!v.scheduled(d)) continue;
    if (!v.done(d)) break;
    n++;
  }
  return n;
}

export function bestStreak(v: HabitView, today: LocalDate): number {
  let best = 0;
  let run = 0;
  for (let d = v.habit.startDate; d <= today; d = addDays(d, 1)) {
    if (!v.scheduled(d)) continue;
    run = v.done(d) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Выполнение за последние 30 дней (не раньше старта), %: галочки / дни по расписанию, не больше 100. */
export function rate30(v: HabitView, today: LocalDate): number {
  const from = addDays(today, -29) > v.habit.startDate ? addDays(today, -29) : v.habit.startDate;
  let expected = 0;
  let done = 0;
  for (let d = from; d <= today; d = addDays(d, 1)) {
    if (v.scheduled(d)) expected++;
    if (v.done(d)) done++;
  }
  if (!expected) return done ? 100 : 0;
  return Math.min(100, Math.round((done * 100) / expected));
}

/** Неделя пн–вс, в которую попадает дата. */
export function weekOf(v: HabitView, date: LocalDate): { date: LocalDate; state: DayState }[] {
  const monday = mondayOf(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    return { date: d, state: v.state(d) };
  });
}

/** Календарь за 12 недель: строки — недели (пн–вс), первая — текущая, ниже — всё старше (читается сверху вниз). */
export function calendarWeeks(v: HabitView, today: LocalDate, weeks = 12): { date: LocalDate; state: DayState }[][] {
  const current = mondayOf(today);
  return Array.from({ length: weeks }, (_, w) => weekOf(v, addDays(current, -7 * w)));
}

/** «Каждый день» или «Пн, Ср, Пт». */
export function scheduleLabel(habit: Pick<Habit, 'days'>): string {
  if (isEveryDay(habit)) return 'Каждый день';
  return [...new Set(habit.days)].sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d - 1]).join(', ');
}

/** Слова для серии: «дней» для ежедневных, «раз» для привычек по дням недели. */
export function streakUnit(habit: Pick<Habit, 'days'>): readonly [string, string, string] {
  return isEveryDay(habit) ? ['день', 'дня', 'дней'] : ['раз', 'раза', 'раз'];
}

/** Подпись на карточке: расписание · подпись · серия. */
export function habitSummary(v: HabitView, today: LocalDate): string {
  const { habit } = v;
  const s = currentStreak(v, today);
  const parts = [scheduleLabel(habit)];
  if (habit.note) parts.push(habit.note);
  if (s > 1) parts.push(`серия ${s} ${plural(s, streakUnit(habit))}`);
  return parts.join(' · ');
}

/** Готовые шаблоны в редакторе. */
export const HABIT_TEMPLATES: readonly Pick<Habit, 'name' | 'icon' | 'color' | 'days' | 'note'>[] = [
  { name: 'Спортзал', icon: 'Dumbbell', color: 'blue', days: [1, 3, 5] },
  { name: 'Бассейн', icon: 'Waves', color: 'teal', days: [2, 4] },
  { name: 'Вода', icon: 'Droplet', color: 'sky', note: '2 литра' },
  { name: 'Чтение', icon: 'BookOpen', color: 'violet', note: '20 страниц' },
  { name: 'Медитация', icon: 'Leaf', color: 'green' },
  { name: 'Без сахара', icon: 'Ban', color: 'rose' },
];
