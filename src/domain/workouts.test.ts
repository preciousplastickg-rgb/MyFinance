import { describe, expect, it } from 'vitest';
import { habitView, weekCount } from './habits';
import type { Habit, Workout, WorkoutSet } from './types';
import {
  describeSets, estimatedMax, formatMax, exerciseHistory, formatDuration, formatWeight, lastSession, pacePer100, parseDuration, parseWeight,
  poolStats, previousBestMax, volumeKg, workoutSummary,
} from './workouts';

let n = 0;
const set = (workoutId: string, weightKg: number, reps: number, exerciseId = 'leg'): WorkoutSet => ({
  id: `s${n++}`, workoutId, exerciseId, order: n, weightG: Math.round(weightKg * 1000), reps,
});
const gym = (id: string, date: string): Workout => ({ id, date, type: 'gym', createdAt: n++, updatedAt: 0 });
const pool = (id: string, date: string, distanceM: number, durationS?: number): Workout => ({ id, date, type: 'pool', distanceM, durationS, createdAt: n++, updatedAt: 0 });

describe('вес и время', () => {
  it('вес в граммах', () => {
    expect(parseWeight('42,5')).toBe(42_500);
    expect(parseWeight('42.5')).toBe(42_500);
    expect(parseWeight('1,25')).toBe(1_250);
    expect(parseWeight('40')).toBe(40_000);
    expect(parseWeight('abc')).toBeNull();
    expect(formatWeight(42_500)).toBe('42,5');
    expect(formatWeight(40_000)).toBe('40');
    expect(formatWeight(1_250)).toBe('1,25');
  });
  it('время в секундах', () => {
    expect(parseDuration('32:00')).toBe(1_920);
    expect(parseDuration('32')).toBe(1_920);
    expect(parseDuration('1:05:10')).toBe(3_910);
    expect(parseDuration('32:75')).toBeNull();
    expect(formatDuration(1_920)).toBe('32:00');
    expect(formatDuration(3_910)).toBe('1:05:10');
  });
});

describe('приёмка этапа 10', () => {
  it('3 × 10 × 40 кг → объём 1 200 кг, максимум ≈ 53,3 кг', () => {
    const sets = [set('w', 40, 10), set('w', 40, 10), set('w', 40, 10)];
    expect(volumeKg(sets)).toBe(1_200);
    expect(estimatedMax(40_000, 10)).toBe(53_333);
    expect(formatMax(estimatedMax(40_000, 10))).toBe('53,3');
    expect(describeSets(sets)).toBe('3 × 10 × 40 кг');
  });
  it('1 000 м за 32:00 → темп 3:12', () => {
    expect(formatDuration(pacePer100(1_000, parseDuration('32:00')!)!)).toBe('3:12');
    expect(workoutSummary(pool('p', '2026-11-04', 1_000, 1_920), [])).toBe('1 000 м · 32:00 · 3:12 / 100 м');
  });
  it('тренировка в зале отмечает «Спортзал 3 раза в неделю»', () => {
    const habit: Habit = { id: 'h', name: 'Спортзал', icon: 'Dumbbell', color: '#2448D6', kind: 'weekly', target: 3, workoutType: 'gym', startDate: '2026-10-01', sortOrder: 0, archived: false };
    const v = habitView(habit, [], [gym('a', '2026-11-02'), gym('b', '2026-11-04'), pool('c', '2026-11-03', 500)], '2026-11-04');
    expect(v.done('2026-11-04')).toBe(true);
    expect(weekCount(v, '2026-11-04')).toBe(2);
  });
});

describe('прогрессия тренажёра', () => {
  const workouts = [gym('w1', '2026-10-20'), gym('w2', '2026-10-27'), gym('w3', '2026-11-03')];
  const sets = [
    set('w1', 40, 10), set('w1', 40, 10),
    set('w2', 42.5, 10), set('w2', 42.5, 8),
    set('w3', 42.5, 8), set('w3', 40, 8),
    set('w3', 20, 15, 'other'),
  ];
  it('рабочий вес, объём, расчётный максимум и рекорды', () => {
    const h = exerciseHistory('leg', workouts, sets);
    expect(h.map((s) => [s.date, s.topWeightG, s.volumeKg, s.bestMaxG, s.record])).toEqual([
      ['2026-10-20', 40_000, 800, 53_333, false],
      ['2026-10-27', 42_500, 765, 56_667, true],
      ['2026-11-03', 42_500, 660, 53_833, false],
    ]);
  });
  it('прошлый раз и лучший максимум без текущей тренировки', () => {
    expect(describeSets(lastSession('leg', workouts, sets, 'w3')!.sets)).toBe('42,5×10, 42,5×8 кг');
    expect(previousBestMax('leg', workouts, sets, 'w2')).toBe(53_833);
    expect(lastSession('none', workouts, sets)).toBeUndefined();
  });
  it('сводка тренировки', () => {
    expect(workoutSummary(workouts[2]!, sets)).toBe('2 тренажёра · 3 подх. · 960 кг');
  });
});

describe('бассейн', () => {
  it('дистанция по неделям, лучший темп, самая длинная', () => {
    const ws = [pool('a', '2026-10-27', 800, 1_680), pool('b', '2026-11-02', 1_000, 1_920), pool('c', '2026-11-04', 1_500), gym('g', '2026-11-03')];
    const s = poolStats(ws, '2026-11-04', 3);
    expect(s.weeks).toEqual([
      { monday: '2026-10-19', distanceM: 0 },
      { monday: '2026-10-26', distanceM: 800 },
      { monday: '2026-11-02', distanceM: 2_500 },
    ]);
    expect(s.bestPace?.pace).toBe(192);
    expect(s.longest?.id).toBe('c');
  });
});
