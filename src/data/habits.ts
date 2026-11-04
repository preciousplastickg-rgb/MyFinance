import { db } from '../db';
import type { Habit, Id, LocalDate } from '../domain/types';

const newId = () => crypto.randomUUID();

export async function saveHabit(habit: Habit): Promise<void> {
  await db.habits.put(habit);
}

export async function nextHabitOrder(): Promise<number> {
  const last = await db.habits.orderBy('sortOrder').last();
  return last ? last.sortOrder + 1 : 0;
}

/** Одна запись на привычку и день: значение задаётся целиком, 0 — запись удаляется. */
export async function setHabitValue(habitId: Id, date: LocalDate, value: number): Promise<void> {
  await db.transaction('rw', db.habitLogs, async () => {
    const existing = await db.habitLogs.where('[habitId+date]').equals([habitId, date]).toArray();
    await db.habitLogs.bulkDelete(existing.map((l) => l.id));
    if (value > 0) await db.habitLogs.add({ id: newId(), habitId, date, value, at: Date.now() });
  });
}

export async function getHabitValue(habitId: Id, date: LocalDate): Promise<number> {
  const logs = await db.habitLogs.where('[habitId+date]').equals([habitId, date]).toArray();
  return logs.reduce((s, l) => s + l.value, 0);
}

/** Да/нет, N раз в неделю, срыв: переключить отметку за день. */
export async function toggleHabitDay(habitId: Id, date: LocalDate): Promise<void> {
  await setHabitValue(habitId, date, (await getHabitValue(habitId, date)) > 0 ? 0 : 1);
}

/** Количество: «+1» (или −1). Чтение и запись в одной транзакции — быстрые тапы не теряются. */
export async function addHabitCount(habitId: Id, date: LocalDate, delta: number): Promise<number> {
  return db.transaction('rw', db.habitLogs, async () => {
    const next = Math.max(0, (await getHabitValue(habitId, date)) + delta);
    await setHabitValue(habitId, date, next);
    return next;
  });
}
