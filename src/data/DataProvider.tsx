import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { db } from '../db';
import { DEFAULT_SETTINGS } from '../db/db';
import { computeBalances } from '../domain/balance';
import { byGoalOrder } from '../domain/goals';
import { rateBook, savedRate, type RateBook } from '../domain/rate';
import type {
  Account, Area, Category, Debt, Goal, Habit, HabitLog, Id, Minor, OccurrenceLog, Recurring, Settings, Task, TaskEvent, Transaction,
} from '../domain/types';
import { useLiveQuery } from './useLiveQuery';
import { useLiveTable } from './liveTable';

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

const byId = (r: { id: Id }) => r.id;
// Как orderBy('sortOrder') у Dexie: при равном sortOrder — по ключу.
const bySortOrder = <T extends { id: Id; sortOrder: number }>(rows: T[]) => rows.sort((a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : 1));
/** Цели — в порядке списка (этап 29: перетаскиванием), без порядка — по дате создания. */
const byGoalSort = (rows: Goal[]) => rows.sort(byGoalOrder);
const notDeleted = (rows: Recurring[]) => rows.filter((r) => !r.deletedAt);

export function DataProvider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  // Таблицы живут в памяти и после записи дочитываются точечно (liveTable), а не целиком, как делал liveQuery с toArray.
  const accounts = useLiveTable(db.accounts, byId, bySortOrder);
  const categories = useLiveTable(db.categories, byId, bySortOrder);
  const transactions = useLiveTable(db.transactions, byId);
  const recurring = useLiveTable(db.recurring, byId, notDeleted);
  const occurrenceLog = useLiveTable(db.occurrenceLog, byId);
  const settings = useLiveQuery(async () => (await db.settings.get('main')) ?? DEFAULT_SETTINGS);
  const areas = useLiveTable(db.areas, byId, bySortOrder);
  const tasks = useLiveTable(db.tasks, byId);
  const taskEvents = useLiveTable(db.taskEvents, byId);
  const habits = useLiveTable(db.habits, byId, bySortOrder);
  const habitLogs = useLiveTable(db.habitLogs, byId);
  const debts = useLiveTable(db.debts, byId);
  const goals = useLiveTable(db.goals, byId, byGoalSort);
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
      accounts: accounts as Account[], categories: categories as Category[], transactions: transactions as Transaction[],
      recurring: recurring as Recurring[], occurrenceLog: occurrenceLog as OccurrenceLog[], settings, areas: areas as Area[],
      tasks: tasks as Task[], taskEvents: taskEvents as TaskEvent[], habits: habits as Habit[], habitLogs: habitLogs as HabitLog[],
      debts: debts as Debt[], goals: goals as Goal[], ...money,
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
