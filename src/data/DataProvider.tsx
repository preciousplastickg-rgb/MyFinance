import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { db } from '../db';
import { DEFAULT_SETTINGS } from '../db/db';
import { computeBalances } from '../domain/balance';
import { rateHistory, type RatePoint } from '../domain/rate';
import type {
  Account, Area, Category, Id, Minor, OccurrenceLog, Recurring, Settings, Task, TaskEvent, Transaction,
} from '../domain/types';
import { useLiveQuery } from './useLiveQuery';

export interface Data {
  accounts: Account[]; // все, по sortOrder, включая архивные
  categories: Category[]; // все, по sortOrder
  transactions: Transaction[];
  recurring: Recurring[];
  occurrenceLog: OccurrenceLog[];
  settings: Settings;
  areas: Area[];
  tasks: Task[];
  taskEvents: TaskEvent[];
  // производные
  accountById: Map<Id, Account>;
  categoryById: Map<Id, Category>;
  balances: Map<Id, Minor>;
  rates: RatePoint[];
}

const DataContext = createContext<Data | null>(null);

export function DataProvider({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const accounts = useLiveQuery(() => db.accounts.orderBy('sortOrder').toArray());
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray());
  const transactions = useLiveQuery(() => db.transactions.toArray());
  const recurring = useLiveQuery(() => db.recurring.toArray());
  const occurrenceLog = useLiveQuery(() => db.occurrenceLog.toArray());
  const settings = useLiveQuery(async () => (await db.settings.get('main')) ?? DEFAULT_SETTINGS);
  const areas = useLiveQuery(() => db.areas.orderBy('sortOrder').toArray());
  const tasks = useLiveQuery(() => db.tasks.toArray());
  const taskEvents = useLiveQuery(() => db.taskEvents.toArray());

  const data = useMemo<Data | null>(() => {
    if (!accounts || !categories || !transactions || !recurring || !occurrenceLog || !settings || !areas || !tasks || !taskEvents) {
      return null;
    }
    return {
      accounts, categories, transactions, recurring, occurrenceLog, settings, areas, tasks, taskEvents,
      accountById: new Map(accounts.map((a) => [a.id, a])),
      categoryById: new Map(categories.map((c) => [c.id, c])),
      balances: computeBalances(accounts, transactions),
      rates: rateHistory(transactions, settings),
    };
  }, [accounts, categories, transactions, recurring, occurrenceLog, settings, areas, tasks, taskEvents]);

  if (!data) return <>{fallback ?? null}</>;
  return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}

export function useData(): Data {
  const data = useContext(DataContext);
  if (!data) throw new Error('useData вне DataProvider');
  return data;
}
