import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { toLocalDate } from '../domain/date';
import type { Id } from '../domain/types';

export type Tab = 'today' | 'money' | 'tasks' | 'reports';

/** Экраны поверх вкладок (стек). */
export type Screen =
  | { name: 'settings' }
  | { name: 'accounts' }
  | { name: 'categories' }
  | { name: 'areas' }
  | { name: 'recurring' }
  | { name: 'subscriptions' };

export interface EntryOptions {
  type?: 'expense' | 'income' | 'transfer';
  accountId?: Id;
}

interface Nav {
  tab: Tab;
  setTab: (tab: Tab) => void;
  stack: Screen[];
  push: (screen: Screen) => void;
  pop: () => void;
  entry: EntryOptions | null;
  openEntry: (options?: EntryOptions) => void;
  closeEntry: () => void;
  /** Фильтр истории по счёту — тап по карточке счёта на «Сегодня». */
  moneyAccount: Id | null;
  showAccountHistory: (id: Id | null) => void;
  /** «Дела»: задачи или привычки. */
  tasksMode: 'tasks' | 'habits';
  showTasks: (mode: 'tasks' | 'habits') => void;
  reportsMode: ReportsMode;
  showReports: (mode: ReportsMode) => void;
}

export type ReportsMode = 'money' | 'tasks' | 'habits';

const NavContext = createContext<Nav | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>('today');
  const [stack, setStack] = useState<Screen[]>([]);
  const [entry, setEntry] = useState<EntryOptions | null>(null);
  const [moneyAccount, setMoneyAccount] = useState<Id | null>(null);
  const [tasksMode, setTasksMode] = useState<'tasks' | 'habits'>('tasks');
  const [reportsMode, setReportsMode] = useState<ReportsMode>('money');

  const setTab = useCallback((t: Tab) => {
    setStack([]);
    setTabState(t);
    window.scrollTo(0, 0);
  }, []);
  const push = useCallback((s: Screen) => {
    setStack((prev) => [...prev, s]);
    window.scrollTo(0, 0);
  }, []);
  const pop = useCallback(() => setStack((prev) => prev.slice(0, -1)), []);
  const openEntry = useCallback((o: EntryOptions = {}) => setEntry(o), []);
  const closeEntry = useCallback(() => setEntry(null), []);
  const showAccountHistory = useCallback((id: Id | null) => {
    setMoneyAccount(id);
    setStack([]);
    setTabState('money');
    window.scrollTo(0, 0);
  }, []);

  const showTasks = useCallback((mode: 'tasks' | 'habits') => {
    setTasksMode(mode);
    setStack([]);
    setTabState('tasks');
    window.scrollTo(0, 0);
  }, []);

  const showReports = useCallback((mode: ReportsMode) => {
    setReportsMode(mode);
    setStack([]);
    setTabState('reports');
    window.scrollTo(0, 0);
  }, []);

  const value = useMemo(
    () => ({ tab, setTab, stack, push, pop, entry, openEntry, closeEntry, moneyAccount, showAccountHistory, tasksMode, showTasks, reportsMode, showReports }),
    [tab, setTab, stack, push, pop, entry, openEntry, closeEntry, moneyAccount, showAccountHistory, tasksMode, showTasks, reportsMode, showReports],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav вне NavProvider');
  return nav;
}

/** Сегодня по Бишкеку. Пересчитывается при каждом рендере: приложение может висеть открытым через полночь. */
export function useToday(): string {
  return toLocalDate(Date.now());
}
