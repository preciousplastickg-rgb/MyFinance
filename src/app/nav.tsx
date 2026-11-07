import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { minutesOfDay, toLocalDate } from '../domain/date';
import { INCOME_MINUTES } from '../domain/recurring';
import type { Id } from '../domain/types';

export type Tab = 'today' | 'money' | 'tasks' | 'goals' | 'reports';

/** Экраны поверх вкладок (стек). */
export type Screen =
  | { name: 'settings' }
  | { name: 'accounts' }
  | { name: 'categories' }
  | { name: 'areas' }
  | { name: 'recurring'; back?: string }
  | { name: 'subscriptions' }
  | { name: 'rates' }
  /** Долги «мне должны / я должен» (этап 17). back — подпись «‹ Назад»: откуда пришли. */
  | { name: 'debts'; back?: string }
  /** Копилка (этап 20). */
  | { name: 'savings'; back?: string }
  /** Итог выбранного дня — из календаря на «Сегодня». */
  | { name: 'day'; date: string }
  /** Счёт: остаток, пришло и ушло за месяц, операции (этап 25) — по тапу на счёт на «Сегодня». */
  | { name: 'account'; id: Id }
  /** Цель (редизайн 2e): экран цели и её создание/правка. */
  | { name: 'goal'; id: Id }
  | { name: 'goalEditor'; id?: Id };

export interface EntryOptions {
  type?: 'expense' | 'income' | 'transfer';
  accountId?: Id;
  /** Перевод: куда — «Пополнить» копилку (этап 20). */
  toAccountId?: Id;
  /** Дата новой записи — «Запись на этот день» из итога дня. */
  date?: string;
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
  /** «Дела»: задачи, привычки или цели (цели — третья вкладка при «+» по центру, этап 26). */
  tasksMode: TasksMode;
  showTasks: (mode: TasksMode) => void;
  /** Сменить раздел «Дел» или вкладку, не закрывая экраны стека (нормализация при смене места «+» из настроек). */
  setTasksMode: (mode: TasksMode) => void;
  replaceTab: (tab: Tab) => void;
  reportsMode: ReportsMode;
  /** month — открыть отчёт за этот месяц (плитки «Доходы / Расходы» в «Деньгах»). */
  showReports: (mode: ReportsMode, month?: string) => void;
  /** Месяцы «Денег» и отчёта живут здесь, чтобы не сбрасываться при переходах. null — текущий. */
  moneyMonth: string | null;
  setMoneyMonth: (month: string | null) => void;
  reportsMonth: string | null;
  setReportsMonth: (month: string | null) => void;
}

export type ReportsMode = 'money' | 'tasks' | 'habits';
export type TasksMode = 'tasks' | 'habits' | 'goals';

const NavContext = createContext<Nav | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>('today');
  const [stack, setStack] = useState<Screen[]>([]);
  const [entry, setEntry] = useState<EntryOptions | null>(null);
  const [moneyAccount, setMoneyAccount] = useState<Id | null>(null);
  const [tasksMode, setTasksMode] = useState<TasksMode>('tasks');
  const [reportsMode, setReportsMode] = useState<ReportsMode>('money');
  const [moneyMonth, setMoneyMonth] = useState<string | null>(null);
  const [reportsMonth, setReportsMonth] = useState<string | null>(null);
  // Прокрутка вкладки на момент открытия экрана из стека — вернуться на то же место.
  const scrollStack = useRef<number[]>([]);

  const setTab = useCallback((t: Tab) => {
    setStack([]);
    setTabState(t);
    window.scrollTo(0, 0);
  }, []);
  const push = useCallback((s: Screen) => {
    scrollStack.current.push(window.scrollY);
    setStack((prev) => [...prev, s]);
    window.scrollTo(0, 0);
  }, []);
  const pop = useCallback(() => {
    const y = scrollStack.current.pop() ?? 0;
    setStack((prev) => prev.slice(0, -1));
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, []);
  const openEntry = useCallback((o: EntryOptions = {}) => setEntry(o), []);
  const closeEntry = useCallback(() => setEntry(null), []);
  const showAccountHistory = useCallback((id: Id | null) => {
    setMoneyAccount(id);
    setStack([]);
    setTabState('money');
    window.scrollTo(0, 0);
  }, []);

  const replaceTab = useCallback((t: Tab) => setTabState(t), []);
  const showTasks = useCallback((mode: TasksMode) => {
    setTasksMode(mode);
    setStack([]);
    setTabState('tasks');
    window.scrollTo(0, 0);
  }, []);

  const showReports = useCallback((mode: ReportsMode, month?: string) => {
    setReportsMode(mode);
    if (month !== undefined) setReportsMonth(month);
    setStack([]);
    setTabState('reports');
    window.scrollTo(0, 0);
  }, []);

  const value = useMemo(
    () => ({
      tab, setTab, replaceTab, stack, push, pop, entry, openEntry, closeEntry, moneyAccount, showAccountHistory, tasksMode, showTasks, setTasksMode, reportsMode, showReports,
      moneyMonth, setMoneyMonth, reportsMonth, setReportsMonth,
    }),
    [tab, setTab, replaceTab, stack, push, pop, entry, openEntry, closeEntry, moneyAccount, showAccountHistory, tasksMode, showTasks, reportsMode, showReports, moneyMonth, reportsMonth],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav вне NavProvider');
  return nav;
}

// iOS держит PWA в памяти сутками: «сегодня» сменяется само — при возврате в приложение и раз в 30 с.
const todayListeners = new Set<() => void>();
let todayTimer: ReturnType<typeof setInterval> | undefined;
const notifyToday = () => todayListeners.forEach((l) => l());
const onVisible = () => {
  if (document.visibilityState === 'visible') notifyToday();
};

function subscribeToday(listener: () => void): () => void {
  todayListeners.add(listener);
  if (todayListeners.size === 1) {
    todayTimer = setInterval(notifyToday, 30_000);
    document.addEventListener('visibilitychange', onVisible);
  }
  return () => {
    todayListeners.delete(listener);
    if (todayListeners.size === 0) {
      clearInterval(todayTimer);
      document.removeEventListener('visibilitychange', onVisible);
    }
  };
}

const todaySnapshot = () => toLocalDate(Date.now());

/** Сегодня по Бишкеку; после полуночи экран перерисовывается сам. */
export function useToday(): string {
  return useSyncExternalStore(subscribeToday, todaySnapshot);
}

const incomeTimeSnapshot = () => minutesOfDay(Date.now()) >= INCOME_MINUTES;

/** Наступило ли 17:00 по Бишкеку — время зачисления дохода. Обновляется вместе с «сегодня». */
export function useIncomeTimePassed(): boolean {
  return useSyncExternalStore(subscribeToday, incomeTimeSnapshot);
}
