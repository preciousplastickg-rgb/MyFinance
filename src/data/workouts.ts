import { db } from '../db';
import type { Exercise, Id, Workout, WorkoutSet } from '../domain/types';

/** Тренировка и её подходы — одной транзакцией; при правке подходы заменяются целиком. */
export async function saveWorkout(workout: Workout, sets: WorkoutSet[]): Promise<void> {
  await db.transaction('rw', db.workouts, db.workoutSets, async () => {
    await db.workouts.put(workout);
    const old = await db.workoutSets.where('workoutId').equals(workout.id).primaryKeys();
    await db.workoutSets.bulkDelete(old);
    if (sets.length) await db.workoutSets.bulkAdd(sets);
  });
}

export async function deleteWorkout(id: Id): Promise<{ workout: Workout; sets: WorkoutSet[] } | null> {
  return db.transaction('rw', db.workouts, db.workoutSets, async () => {
    const workout = await db.workouts.get(id);
    if (!workout) return null;
    const sets = await db.workoutSets.where('workoutId').equals(id).toArray();
    await db.workouts.delete(id);
    await db.workoutSets.bulkDelete(sets.map((s) => s.id));
    return { workout, sets };
  });
}

export async function createExercise(name: string, icon = 'Dumbbell'): Promise<Exercise> {
  const last = await db.exercises.orderBy('sortOrder').last();
  const exercise: Exercise = { id: crypto.randomUUID(), name: name.trim(), icon, sortOrder: last ? last.sortOrder + 1 : 0, archived: false };
  await db.exercises.add(exercise);
  return exercise;
}

export async function saveExercise(exercise: Exercise): Promise<void> {
  await db.exercises.put(exercise);
}
