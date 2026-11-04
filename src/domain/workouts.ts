import { mulDivRound } from './arith';
import { addDays, weekdayOf } from './date';
import type { Id, LocalDate, Workout, WorkoutSet } from './types';

// ── Вес и время: целые граммы и секунды ─────────────────

/** «42,5» / «42.5» / «40» → граммы. Не больше двух знаков после запятой. */
export function parseWeight(text: string): number | null {
  const m = /^(\d{1,4})(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!m) return null;
  return Number(m[1]) * 1000 + Number(((m[2] ?? '') + '00').slice(0, 2)) * 10;
}

/** 42 500 → «42,5»; 40 000 → «40»; 1 250 → «1,25». */
export function formatWeight(grams: number): string {
  const kg = Math.floor(grams / 1000);
  const rest = Math.round((grams % 1000) / 10);
  if (!rest) return String(kg);
  return `${kg},${String(rest).padStart(2, '0').replace(/0$/, '')}`;
}

/** «32:00», «32», «1:05:10» → секунды. */
export function parseDuration(text: string): number | null {
  const parts = text.trim().split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d{1,3}$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.length === 1) return nums[0]! * 60;
  if (nums.slice(1).some((n) => n >= 60)) return null;
  return nums.reduce((s, n) => s * 60 + n, 0);
}

/** 1 920 → «32:00»; 3 910 → «1:05:10». */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Темп на 100 м, секунды: 1 000 м за 32:00 → 192 (3:12). */
export function pacePer100(distanceM: number, durationS: number): number | null {
  if (distanceM <= 0 || durationS <= 0) return null;
  return mulDivRound(durationS, 100, distanceM);
}

// ── Силовые ─────────────────────────────────────────────

/** Расчётный максимум на 1 повтор по Эпли: вес × (30 + повторы) / 30, в граммах. */
export function estimatedMax(weightG: number, reps: number): number {
  if (reps <= 0 || weightG <= 0) return 0;
  if (reps === 1) return weightG;
  return mulDivRound(weightG, 30 + reps, 30);
}

/** Объём Σ вес × повторы, в килограммах (целое, округление). */
export function volumeKg(sets: readonly Pick<WorkoutSet, 'weightG' | 'reps'>[]): number {
  return mulDivRound(sets.reduce((s, x) => s + x.weightG * x.reps, 0), 1, 1000);
}

/** «3 × 10 × 40 кг», если подходы одинаковые; иначе «40×10, 45×8, 50×6 кг». */
export function describeSets(sets: readonly Pick<WorkoutSet, 'weightG' | 'reps'>[]): string {
  if (!sets.length) return '';
  const same = sets.every((s) => s.weightG === sets[0]!.weightG && s.reps === sets[0]!.reps);
  if (same) return `${sets.length} × ${sets[0]!.reps} × ${formatWeight(sets[0]!.weightG)} кг`;
  return `${sets.map((s) => `${formatWeight(s.weightG)}×${s.reps}`).join(', ')} кг`;
}

export interface ExerciseSession {
  workoutId: Id;
  date: LocalDate;
  sets: WorkoutSet[];
  topWeightG: number; // рабочий вес — максимум за тренировку
  volumeKg: number;
  bestMaxG: number; // лучший расчётный максимум
  record: boolean; // побит прошлый лучший расчётный максимум
}

const workoutOrder = (a: Workout, b: Workout) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt);

/** История тренажёра по тренировкам, от старых к новым. */
export function exerciseHistory(exerciseId: Id, workouts: readonly Workout[], sets: readonly WorkoutSet[]): ExerciseSession[] {
  const byWorkout = new Map<Id, WorkoutSet[]>();
  for (const s of sets) {
    if (s.exerciseId !== exerciseId) continue;
    byWorkout.set(s.workoutId, [...(byWorkout.get(s.workoutId) ?? []), s]);
  }
  let best = 0;
  return [...workouts]
    .filter((w) => byWorkout.has(w.id))
    .sort(workoutOrder)
    .map((w) => {
      const list = byWorkout.get(w.id)!.sort((a, b) => a.order - b.order);
      const bestMaxG = Math.max(0, ...list.map((s) => estimatedMax(s.weightG, s.reps)));
      const record = best > 0 && bestMaxG > best;
      best = Math.max(best, bestMaxG);
      return { workoutId: w.id, date: w.date, sets: list, topWeightG: Math.max(0, ...list.map((s) => s.weightG)), volumeKg: volumeKg(list), bestMaxG, record };
    });
}

/** Подходы последней тренировки на тренажёре (кроме текущей) — для подстановки и «Прошлый раз». */
export function lastSession(exerciseId: Id, workouts: readonly Workout[], sets: readonly WorkoutSet[], excludeWorkoutId?: Id): ExerciseSession | undefined {
  const history = exerciseHistory(exerciseId, workouts.filter((w) => w.id !== excludeWorkoutId), sets);
  return history[history.length - 1];
}

/** Лучший расчётный максимум до этой тренировки — для живого бейджа «Рекорд». */
export function previousBestMax(exerciseId: Id, workouts: readonly Workout[], sets: readonly WorkoutSet[], excludeWorkoutId?: Id): number {
  return Math.max(0, ...exerciseHistory(exerciseId, workouts.filter((w) => w.id !== excludeWorkoutId), sets).map((s) => s.bestMaxG));
}

// ── Бассейн ─────────────────────────────────────────────

export interface PoolStats {
  weeks: { monday: LocalDate; distanceM: number }[];
  bestPace?: { pace: number; workout: Workout };
  longest?: Workout;
  sessions: (Workout & { pace: number | null })[];
}

/** Дистанция по неделям (последние N), лучший темп, самая длинная дистанция. */
export function poolStats(workouts: readonly Workout[], today: LocalDate, weeks = 8): PoolStats {
  const pool = workouts.filter((w) => w.type === 'pool' && (w.distanceM ?? 0) > 0).sort(workoutOrder);
  const thisMonday = addDays(today, 1 - weekdayOf(today));
  const ws = Array.from({ length: weeks }, (_, i) => addDays(thisMonday, -7 * (weeks - 1 - i)));
  const sessions = pool.map((w) => ({ ...w, pace: w.durationS ? pacePer100(w.distanceM!, w.durationS) : null }));
  let bestPace: PoolStats['bestPace'];
  for (const s of sessions) if (s.pace !== null && (!bestPace || s.pace < bestPace.pace)) bestPace = { pace: s.pace, workout: s };
  const longest = pool.reduce<Workout | undefined>((m, w) => (!m || w.distanceM! > m.distanceM! ? w : m), undefined);
  return {
    weeks: ws.map((monday) => ({
      monday,
      distanceM: pool.filter((w) => w.date >= monday && w.date <= addDays(monday, 6)).reduce((s, w) => s + w.distanceM!, 0),
    })),
    bestPace,
    longest,
    sessions,
  };
}

/** Строка тренировки в списке. */
export function workoutSummary(w: Workout, sets: readonly WorkoutSet[]): string {
  if (w.type === 'pool') {
    const parts = [`${(w.distanceM ?? 0).toLocaleString('ru-RU').replace(/\s/g, ' ')} м`];
    if (w.durationS) parts.push(formatDuration(w.durationS));
    const pace = w.distanceM && w.durationS ? pacePer100(w.distanceM, w.durationS) : null;
    if (pace) parts.push(`${formatDuration(pace)} / 100 м`);
    return parts.join(' · ');
  }
  const own = sets.filter((s) => s.workoutId === w.id);
  const exercises = new Set(own.map((s) => s.exerciseId)).size;
  const kg = volumeKg(own).toLocaleString('ru-RU').replace(/\s/g, ' ');
  const ex = exercises % 10 === 1 && exercises % 100 !== 11 ? 'тренажёр' : [2, 3, 4].includes(exercises % 10) && ![12, 13, 14].includes(exercises % 100) ? 'тренажёра' : 'тренажёров';
  return `${exercises} ${ex} · ${own.length} подх. · ${kg} кг`;
}

/** Расчётный максимум для показа — до 0,1 кг: 53 333 г → «53,3». */
export function formatMax(grams: number): string {
  return formatWeight(mulDivRound(grams, 1, 100) * 100);
}
