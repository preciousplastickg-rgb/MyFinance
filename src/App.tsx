import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { NavProvider, useNav, type ReportsMode, type Screen, type TasksMode } from './app/nav';
import { useAutoIncome } from './app/useAutoIncome';
import { useSwipeDismiss } from './app/useSwipeDismiss';
import { listPager, TAB_ORDER, TAB_ORDER_CENTER, useTabSwipe } from './app/useTabSwipe';
import { SectionPagerProvider } from './app/SectionPager';
import { useTheme } from './app/useTheme';
import { DataProvider, useData } from './data/DataProvider';
import { fabPositionOf } from './domain/appearance';
import { AccountScreen } from './screens/money/AccountScreen';
import { DayScreen } from './screens/day/DayScreen';
import { DebtsScreen } from './screens/debts/DebtsScreen';
import { SavingsScreen } from './screens/savings/SavingsScreen';
import { Money } from './screens/Money';
import { QuickEntry } from './screens/QuickEntry';
import { RecurringScreen } from './screens/recurring/RecurringScreen';
import { Goals } from './screens/Goals';
import { GoalEditor } from './screens/goals/GoalEditor';
import { GoalScreen } from './screens/goals/GoalScreen';
import { Tasks } from './screens/Tasks';
import { Today } from './screens/Today';
import { BottomNav } from './ui/BottomNav';
import { ToastProvider } from './ui/Toast';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import { UpdatePrompt } from './app/UpdatePrompt';

// Редкие экраны — отдельными чанками: главный бандл меньше, старт быстрее. Service worker кладёт чанки в кэш
// заранее, поэтому офлайн и первый переход к ним работают без задержки.
const Onboarding = lazy(() => import('./screens/Onboarding').then((m) => ({ default: m.Onboarding })));
const Reports = lazy(() => import('./screens/Reports').then((m) => ({ default: m.Reports })));
const Settings = lazy(() => import('./screens/Settings').then((m) => ({ default: m.Settings })));
const AccountsScreen = lazy(() => import('./screens/settings/AccountsScreen').then((m) => ({ default: m.AccountsScreen })));
const CategoriesScreen = lazy(() => import('./screens/settings/CategoriesScreen').then((m) => ({ default: m.CategoriesScreen })));
const AreasScreen = lazy(() => import('./screens/settings/AreasScreen').then((m) => ({ default: m.AreasScreen })));
const RatesScreen = lazy(() => import('./screens/settings/RatesScreen').then((m) => ({ default: m.RatesScreen })));

/** Экран из стека: свайп вправо — «Назад», как в iOS. */
function SwipeBack({ children }: { children: ReactNode }) {
  const { pop } = useNav();
  const swipe = useSwipeDismiss(pop);
  return (
    <div {...swipe.handlers} className="min-h-dvh touch-pan-y overflow-x-hidden">
      <div className="min-h-dvh bg-bg" style={swipe.style}>
        {children}
      </div>
    </div>
  );
}

function StackScreen({ screen }: { screen: Screen }) {
  switch (screen.name) {
    case 'settings':
      return <Settings />;
    case 'accounts':
      return <AccountsScreen />;
    case 'categories':
      return <CategoriesScreen />;
    case 'rates':
      return <RatesScreen />;
    case 'areas':
      return <AreasScreen />;
    case 'recurring':
      return <RecurringScreen back={screen.back} />;
    case 'subscriptions':
      return <RecurringScreen subscriptionsOnly />;
    case 'day':
      return <DayScreen date={screen.date} />;
    case 'account':
      return <AccountScreen id={screen.id} back={screen.back} />;
    case 'debts':
      return <DebtsScreen back={screen.back} />;
    case 'savings':
      return <SavingsScreen back={screen.back} />;
    case 'goal':
      return <GoalScreen id={screen.id} />;
    case 'goalEditor':
      return <GoalEditor id={screen.id} />;
    default:
      return null;
  }
}

function Shell() {
  const { settings, accounts } = useData();
  const { tab, setTab, replaceTab, stack, entry, closeEntry, tasksMode, setTasksMode, showTasks, reportsMode, showReports } = useNav();
  useTheme(settings);
  useAutoIncome();
  const center = fabPositionOf(settings) === 'center';
  // Свайп (этап 28): в «Делах» и «Отчётах» короткий свайп листает разделы, широкий — вкладку меню.
  const tasksModes: readonly TasksMode[] = center ? ['tasks', 'habits', 'goals'] : ['tasks', 'habits'];
  const reportsModes: readonly ReportsMode[] = ['money', 'tasks', 'habits'];
  const inner = tab === 'tasks' ? listPager(tasksModes, tasksMode, showTasks) : tab === 'reports' ? listPager(reportsModes, reportsMode, showReports) : null;
  const swipe = useTabSwipe(listPager(center ? TAB_ORDER_CENTER : TAB_ORDER, tab, setTab), inner);

  // «+» по центру (этап 26): вкладки «Цели» в меню нет, цели — третий раздел «Дел». При смене места кнопки
  // (из настроек или бэкапом) открытые цели переезжают туда и обратно, не закрывая экраны стека.
  useEffect(() => {
    if (center && tab === 'goals') {
      setTasksMode('goals');
      replaceTab('tasks');
    } else if (!center && tasksMode === 'goals') {
      setTasksMode('tasks');
      if (tab === 'tasks') replaceTab('goals');
    }
  }, [center, tab, tasksMode, replaceTab, setTasksMode]);

  if (!settings.onboardingDone && accounts.length === 0) {
    return (
      <Suspense fallback={null}>
        <Onboarding />
      </Suspense>
    );
  }

  const top = stack[stack.length - 1];
  return (
    <>
      {top && (
        <SwipeBack key={stack.length}>
          <Suspense fallback={null}>
            <StackScreen screen={top} />
          </Suspense>
        </SwipeBack>
      )}
      {/* Вкладка остаётся смонтированной под экраном из стека: месяц, поиск, вкладка «Дел» не сбрасываются после «‹ Назад». */}
      <div hidden={!!top}>
        <>
          {/* Жест ловит неподвижная обёртка: страница под пальцем может быть сдвинута. */}
          <div {...swipe.handlers} className="min-h-dvh touch-pan-y overflow-x-hidden">
          <main
            key={swipe.enter?.key}
            className={`pb-[calc(var(--nav-bottom)+98px)] ${swipe.settling && !swipe.offset ? 'transition-transform duration-150' : ''} ${
              swipe.enter && !swipe.offset ? (swipe.enter.from === 1 ? 'tab-enter-right' : 'tab-enter-left') : ''
            }`}
            style={{ transform: swipe.offset ? `translateX(${swipe.offset}px)` : undefined }}
          >
            <SectionPagerProvider value={{ offset: swipe.innerOffset, settling: swipe.innerSettling }}>
              {tab === 'today' && <Today />}
              {tab === 'money' && <Money />}
              {tab === 'tasks' && <Tasks />}
              {tab === 'goals' && <Goals />}
              {tab === 'reports' && (
                <Suspense fallback={null}>
                  <Reports />
                </Suspense>
              )}
            </SectionPagerProvider>
          </main>
          </div>
          <BottomNav />
        </>
      </div>
      {entry && <QuickEntry onClose={closeEntry} />}
    </>
  );
}

export function App() {
  return (
    <AppErrorBoundary>
      <ToastProvider>
        <NavProvider>
          <DataProvider>
            <Shell />
          </DataProvider>
          <UpdatePrompt />
        </NavProvider>
      </ToastProvider>
    </AppErrorBoundary>
  );
}
