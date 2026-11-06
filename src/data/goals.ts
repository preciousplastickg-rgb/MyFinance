import { db } from '../db';
import type { Account, Goal, Id } from '../domain/types';

/** Цель и, если нужно, её копилка — одной транзакцией. */
export async function saveGoal(goal: Goal, jar?: Account, links?: { habitIds?: readonly Id[]; taskIds?: readonly Id[] }): Promise<void> {
  await db.transaction('rw', [db.goals, db.accounts, db.habits, db.tasks], async () => {
    if (jar) await db.accounts.put(jar);
    await db.goals.put(goal);
    if (links?.habitIds?.length) await Promise.all(links.habitIds.map((id) => db.habits.update(id, { goalId: goal.id })));
    if (links?.taskIds?.length) await Promise.all(links.taskIds.map((id) => db.tasks.update(id, { goalId: goal.id })));
  });
}

/** Привычка или дело ведёт только к одной цели: undefined — отвязать. */
export async function setHabitGoal(habitId: Id, goalId: Id | undefined): Promise<void> {
  await db.habits.update(habitId, goalId ? { goalId } : ({ goalId: undefined } as Partial<{ goalId: Id }>));
}

export async function setTaskGoal(taskId: Id, goalId: Id | undefined): Promise<void> {
  await db.tasks.update(taskId, goalId ? { goalId } : ({ goalId: undefined } as Partial<{ goalId: Id }>));
}

/** Удалить цель: связи снимаются, копилка остаётся обычной копилкой. */
export async function deleteGoal(id: Id): Promise<void> {
  await db.transaction('rw', [db.goals, db.habits, db.tasks], async () => {
    const habits = await db.habits.where('goalId').equals(id).toArray();
    const tasks = await db.tasks.where('goalId').equals(id).toArray();
    await Promise.all([
      ...habits.map((h) => db.habits.update(h.id, { goalId: undefined } as Partial<{ goalId: Id }>)),
      ...tasks.map((t) => db.tasks.update(t.id, { goalId: undefined } as Partial<{ goalId: Id }>)),
    ]);
    await db.goals.delete(id);
  });
}
