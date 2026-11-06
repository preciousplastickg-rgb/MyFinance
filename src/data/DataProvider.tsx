import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { db } from '../db';
import { DEFAULT_SETTINGS } from '../db/db';
import { computeBalances } from '../domain/balance';
import { rateBook, savedRate, type RateBook } from '../domain/rate';
import type {
  Account, Area, Category, Debt, Goal, Habit, HabitLog, Id, Minor, OccurrenceLog, Recurring, Settings, Task, TaskEvent, Transaction,
} from '../domain/types';
import { useLiveQuery } from './useLiveQuery';

export interface Data {
  accounts: Account[]; // все, по sortOrder, включая архивные
  categories: Category[]; // все, по sortOrder
  transactions: Transaction[];
  recurring: Recurring[]; // без удалённых
  occurrenceLog: OccurrenceLog[];
  settings: Settings;
  areas: Area[];
  tasks: Task[];
  taskEvents: TaskEvent[];
  habits: Habit[]; // по sortOrder, включая архивные
  habitLogs: HabitLog[];
  debts: Debt[];
  goals: Goal[];
  // производные
  accountById: Map<Id, Account>;
  categoryById: Map<Id, Category>;
  balances: Map<Id, Minor>;
  /** История курсов по валютам (обмены + ручная правка). */
  rates: RateBook;
  /** Последний курс валюты: сом за 1 единицу ×10 000. */
  rateFor: (currency: string) => number | undefined;
}

const DataContext = createContext<Data | null>(null);

export function DataProvider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const accounts = useLiveQuery(() => db.accounts.orderBy('sortOrder').toArray());
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray());
  const transactions = useLiveQuery(() => db.transactions.toArray());
  const recurring = useLiveQuery(async () => (await db.recurring.toArray()).filter((r) => !r.deletedAt));
  const occurrenceLog = useLiveQuery(() => db.occurrenceLog.toArray());
  const settings = useLiveQuery(async () => (await db.settings.get('main')) ?? DEFAULT_SETTINGS);
  const areas = useLiveQuery(() => db.areas.orderBy('sortOrder').toArray());
  const tasks = useLiveQuery(() => db.tasks.toArray());
  const taskEvents = useLiveQuery(() => db.taskEvents.toArray());
  const habits = useLiveQuery(() => db.habits.orderBy('sortOrder').toArray());
  const habitLogs = useLiveQuery(() => db.habitLogs.toArray());
  const debts = useLiveQuery(() => db.debts.toArray());
  const goals = useLiveQuery(() => db.goals.orderBy('createdAt').toArray());
  // Таблицы тренировок (этап 13) не читаются: данные лежат в базе и бэкапе, но в приложении их больше нет.

  // Деньги считаются отдельно: отметка привычки или задачи не пересчитывает балансы и историю курсов.
  const money = useMemo(() => {
    if (!accounts || !categories || !transactions || !settings) return null;
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    return {
      accountById,
      categoryById: new Map(categories.map((c) => [c.id, c])),
      balances: computeBalances(accounts, transactions),
      rates: rateBook(transactions, accountById, settings),
      rateFor: (c: string) => savedRate(settings, c)?.rate,
    };
  }, [accounts, categories, transactions, settings]);

  const data = useMemo<Data | null>(() => {
    if (
      !money || !accounts || !categories || !transactions || !recurring || !occurrenceLog || !settings || !areas || !tasks ||
      !taskEvents || !habits || !habitLogs || !debts || !goals
    ) {
      return null;
    }
    return {
      accounts, categories, transactions, recurring, occurrenceLog, settings, areas, tasks, taskEvents,
      habits, habitLogs, debts, goals, ...money,
    };
  }, [money, accounts, categories, transactions, recurring, occurrenceLog, settings, areas, tasks, taskEvents, habits, habitLogs, debts, goals]);

  if (!data) return <>{fallback ?? null}</>;
  return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}

export function useData(): Data {
  const data = useContext(DataContext);
  if (!data) throw new Error('useData вне DataProvider');
  return data;
}
