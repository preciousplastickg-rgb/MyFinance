import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { StackBackContext } from './app/stackBack';
import { NavProvider, useNav, type ReportsMode, type Screen, type TasksMode } from './app/nav';
import { useAutoIncome } from './app/useAutoIncome';
import { useSwipeDismiss } from './app/useSwipeDismiss';
import { IDLE_VIEW, listPager, TAB_ORDER, TAB_ORDER_CENTER, useTabSwipe } from './app/useTabSwipe';
import { PaneActiveContext, SectionPagerProvider } from './app/SectionPager';
import type { Tab } from './app/nav';
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

/** Экран из стека: въезжает справа при открытии, свайп вправо и «‹ Назад» уводят его вправо, как в iOS. */
function SwipeBack({ children, enter }: { children: ReactNode; enter: boolean }) {
  const { pop } = useNav();
  const swipe = useSwipeDismiss(pop);
  return (
    <div {...swipe.handlers} className="min-h-dvh touch-pan-y overflow-x-clip">
      <div className={`min-h-dvh bg-bg ${enter ? 'screen-in' : ''}`} style={swipe.style}>
        <StackBackContext.Provider value={() => swipe.dismiss('x')}>{children}</StackBackContext.Provider>
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

  // Чанк «Отчётов» — заранее, вскоре после старта: при свайпе к ним соседняя вкладка не ждёт загрузки (этап 29).
  useEffect(() => {
    const id = setTimeout(() => void import('./screens/Reports'), 1500);
    return () => clearTimeout(id);
  }, []);

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

  // Редактор цели — окно поверх экрана: под ним остаётся видна страница, с которой его открыли.
  const top = stack[stack.length - 1];
  const modal = top?.name === 'goalEditor' ? top : undefined;
  const pageIndex = modal ? stack.length - 2 : stack.length - 1;
  const page = stack[pageIndex];
  // Экран въезжает справа, только когда его открыли; после «‹ Назад» нижний экран просто показывается.
  const [shown, setShown] = useState({ index: pageIndex, enter: false });
  if (shown.index !== pageIndex) setShown({ index: pageIndex, enter: pageIndex > shown.index });

  if (!settings.onboardingDone && accounts.length === 0) {
    return (
      <Suspense fallback={null}>
        <Onboarding />
      </Suspense>
    );
  }


  const order = center ? TAB_ORDER_CENTER : TAB_ORDER;
  const view = swipe.view;
  const neighbor = view.outer ? order[order.indexOf(tab) + view.outer] : undefined;
  const tabs: Tab[] = neighbor ? [tab, neighbor] : [tab];

  return (
    <>
      {page && (
        <SwipeBack key={pageIndex} enter={shown.enter}>
          <Suspense fallback={null}>
            <StackScreen screen={page} />
          </Suspense>
        </SwipeBack>
      )}
      {modal?.name === 'goalEditor' && <GoalEditor id={modal.id} />}
      {/* Вкладка остаётся смонтированной под экраном из стека: месяц, поиск, вкладка «Дел» не сбрасываются после «‹ Назад». */}
      <div hidden={!!page}>
        {/*
          Жест ловит неподвижная <main>: на ней CSS-переменные смещения. Вкладки — по ключу: соседняя, что ехала рядом за пальцем,
          после жеста становится текущей тем же экземпляром (без повторной загрузки и анимаций). Соседняя — fixed во весь экран,
          поэтому показывает свой верх, как бы ни была прокручена текущая.
        */}
        <main ref={swipe.ref} {...swipe.handlers} className="relative min-h-dvh touch-pan-y overflow-x-clip">
          {tabs.map((t) => {
            const current = t === tab;
            const transform = current ? 'translateX(var(--tab-dx, 0px))' : `translateX(calc(var(--tab-dx, 0px) ${view.outer > 0 ? '+' : '-'} 100%))`;
            return (
              <div
                key={t}
                aria-hidden={current ? undefined : true}
                className={`${current ? 'relative' : 'pointer-events-none fixed inset-0 overflow-hidden bg-bg'} pb-[calc(var(--nav-bottom)+98px+var(--subnav-space,0px))] ${view.settling ? 'settle' : ''}`}
                // Текущая — всегда со сдвигом из переменной (0 вне жеста): палец двигает её, не дожидаясь React.
                style={current || view.active ? { transform } : undefined}
              >
                <PaneActiveContext.Provider value={current}>
                  <SectionPagerProvider value={current ? view : IDLE_VIEW}>
                    <TabPage tab={t} />
                  </SectionPagerProvider>
                </PaneActiveContext.Provider>
              </div>
            );
          })}
        </main>
        <BottomNav />
      </div>
      {entry && <QuickEntry onClose={closeEntry} />}
    </>
  );
}

function TabPage({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'today':
      return <Today />;
    case 'money':
      return <Money />;
    case 'tasks':
      return <Tasks />;
    case 'goals':
      return <Goals />;
    case 'reports':
      return (
        <Suspense fallback={null}>
          <Reports />
        </Suspense>
      );
  }
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
