import { useMemo } from 'react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { goalProgress, type GoalProgress } from '../../domain/goals';
import { habitView, rate30, type HabitView } from '../../domain/habits';
import type { Account, Goal, Minor, Task } from '../../domain/types';

export interface GoalView {
  goal: Goal;
  jar?: Account;
  jarBalance: Minor;
  progress: GoalProgress;
  habits: HabitView[];
  tasks: Task[];
}

/** Цели с прогрессом: копилка, связанные привычки (% за 30 дней) и дела. */
export function useGoalViews(): GoalView[] {
  const { goals, accounts, balances, habits, habitLogs, tasks } = useData();
  const today = useToday();
  return useMemo(
    () =>
      goals
        .filter((g) => !g.archived)
        .map((g) => {
          const jar = g.jarAccountId ? accounts.find((a) => a.id === g.jarAccountId && !a.archived) : undefined;
          const hs = habits.filter((h) => h.goalId === g.id && !h.archived).map((h) => habitView(h, habitLogs, today));
          const ts = tasks.filter((t) => t.goalId === g.id && t.status !== 'deleted');
          const jarBalance = jar ? (balances.get(jar.id) ?? 0) : 0;
          const progress = goalProgress({
            jar: jar?.goal ? { balance: jarBalance, target: jar.goal } : undefined,
            habitRates: hs.map((v) => rate30(v, today)),
            tasks: ts,
          });
          return { goal: g, jar, jarBalance, progress, habits: hs, tasks: ts };
        }),
    [goals, accounts, balances, habits, habitLogs, tasks, today],
  );
}
