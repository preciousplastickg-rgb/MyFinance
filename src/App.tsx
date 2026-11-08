import { lazy, memo, startTransition, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NavProvider, useNav, type ReportsMode, type Screen, type TasksMode } from './app/nav';
import { useAutoIncome } from './app/useAutoIncome';
import { useSwipeDismiss } from './app/useSwipeDismiss';
import { laneNeighbors, laneOrder, pageKey, parsePage, type PageDir, type PageKey } from './app/lane';
import { LaneBusContext, PaneActiveContext } from './app/laneContext';
import { useLaneSwipe } from './app/useTabSwipe';
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

/** Экран из стека: свайп вправо — «Назад», как в iOS (экран едет за пальцем). Открывается и закрывается кнопкой сразу. */
function SwipeBack({ children }: { children: ReactNode }) {
  const { pop } = useNav();
  const swipe = useSwipeDismiss(pop);
  return (
    <div {...swipe.handlers} className="min-h-dvh touch-pan-y overflow-x-clip">
      <div ref={swipe.ref} className="min-h-dvh bg-bg">
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
      return <RecurringScreen only="subscriptions" />;
    case 'loans':
      return <RecurringScreen only="loans" back={screen.back} />;
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

/** Сделать в простое: requestIdleCallback, а где его нет (Safari) — через 200 мс. Возвращает отмену. */
function onIdle(cb: () => void): () => void {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(cb, { timeout: 800 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(cb, 200);
  return () => clearTimeout(id);
}

/**
 * Какие страницы ленты смонтированы: текущая и те её соседи, что уже «прогреты» (соседи тёплой страницы) или нужны жесту
 * прямо сейчас (need). Остальные размонтируются сразу — скрытых копий страниц нет.
 */
function mountedPages(order: readonly PageKey[], current: PageKey, warm: PageKey | null, need: PageKey | null): PageKey[] {
  const n = laneNeighbors(order, current);
  const near = new Set([n.prev, n.next].filter((k): k is PageKey => !!k));
  const keys = new Set<PageKey>([current]);
  const w = warm ? laneNeighbors(order, warm) : {};
  for (const k of [warm, w.prev, w.next, need]) if (k && near.has(k)) keys.add(k);
  return [...keys].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

function Shell() {
  const { settings, accounts } = useData();
  const { tab, setTab, replaceTab, stack, entry, closeEntry, tasksMode, setTasksMode, showTasks, reportsMode, showReports } = useNav();
  useTheme(settings);
  useAutoIncome();
  const center = fabPositionOf(settings) === 'center';
  // Лента (этап 31): вкладки и разделы «Дел» и «Отчётов» — один ряд страниц, свайп — ровно одна страница.
  const order = useMemo(() => laneOrder(center), [center]);
  const current = pageKey(tab, tasksMode, reportsMode);
  const goPage = useCallback(
    (key: PageKey) => {
      const p = parsePage(key);
      if (p.tab === 'tasks') showTasks(p.mode as TasksMode);
      else if (p.tab === 'reports') showReports(p.mode as ReportsMode);
      else setTab(p.tab);
    },
    [setTab, showTasks, showReports],
  );

  // Соседние страницы монтируются заранее, в простое после каждого перехода: к жесту они уже нарисованы. warm отстаёт
  // от текущей страницы, пока не наступит простой. Жест, начатый раньше, просит только того соседа, к которому едет
  // страница (в фоне, прерываемо): рисовать посреди жеста ещё и соседа с другой стороны — лишняя работа под пальцем.
  const [warm, setWarm] = useState<PageKey | null>(null);
  const [need, setNeed] = useState<PageKey | null>(null);
  useEffect(() => {
    if (warm === current) return;
    return onIdle(() => startTransition(() => setWarm(current)));
  }, [current, warm]);
  const mounted = mountedPages(order, current, warm, need);
  const latest = useRef({ order, current, mounted });
  latest.current = { order, current, mounted };
  const onGrab = useCallback((dir: PageDir) => {
    const { order: o, current: c, mounted: m } = latest.current;
    const n = laneNeighbors(o, c);
    const key = dir === 1 ? n.next : n.prev;
    if (key && !m.includes(key)) startTransition(() => setNeed(key));
  }, []);
  const swipe = useLaneSwipe({ order, current, go: goPage, onGrab });

  // Чанк «Отчётов» — заранее, вскоре после старта: соседняя страница «Отчёты» не ждёт загрузки (этап 29).
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

  if (!settings.onboardingDone && accounts.length === 0) {
    return (
      <Suspense fallback={null}>
        <Onboarding />
      </Suspense>
    );
  }

  const n = laneNeighbors(order, current);
  const roleOf = (key: PageKey): SlotRole => (key === current ? 'current' : key === n.prev ? 'prev' : 'next');

  return (
    <LaneBusContext.Provider value={swipe.bus}>
      {page && (
        <SwipeBack key={pageIndex}>
          <Suspense fallback={null}>
            <StackScreen screen={page} />
          </Suspense>
        </SwipeBack>
      )}
      {modal?.name === 'goalEditor' && <GoalEditor id={modal.id} />}
      {/* Вкладка остаётся смонтированной под экраном из стека: месяц, поиск, вкладка «Дел» не сбрасываются после «‹ Назад». */}
      <div hidden={!!page}>
        {/*
          Жест ловит неподвижная <main>, лента внутри едет целиком одним transform. Страницы — по ключу: соседняя, что ехала
          рядом, после жеста становится текущей тем же экземпляром (без повторной загрузки).
        */}
        <main ref={swipe.rootRef} {...swipe.handlers} className="relative min-h-dvh touch-pan-y overflow-x-clip">
          {/* data-ready — соседи текущей страницы смонтированы: к жесту всё нарисовано (по нему e2e ждёт перед свайпом). */}
          <div ref={swipe.laneRef} data-ready={warm === current ? '' : undefined} className="relative min-h-dvh">
            {mounted.map((key) => (
              <LaneSlot key={key} pageKey={key} role={roleOf(key)} />
            ))}
          </div>
        </main>
        <BottomNav />
      </div>
      {entry && <QuickEntry onClose={closeEntry} />}
    </LaneBusContext.Provider>
  );
}

type SlotRole = 'current' | 'prev' | 'next';

/**
 * Место страницы в ленте. Текущая — в потоке документа (прокрутка страницы — прокрутка окна). Соседние — справа и слева
 * за краем экрана, прилипают к верху окна (sticky), поэтому показывают свой верх, как бы ни была прокручена текущая;
 * content-visibility: auto — браузер не тратится на них, пока их не видно. Разметка у всех ролей одна — смена роли
 * не пересоздаёт страницу.
 */
function LaneSlot({ pageKey: key, role }: { pageKey: PageKey; role: SlotRole }) {
  const neighbor = role !== 'current';
  // inert: кнопки соседней страницы недоступны и с клавиатуры (aria-hidden прячет только от скринридера).
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.inert = neighbor;
  }, [neighbor]);
  return (
    <div
      ref={ref}
      aria-hidden={neighbor ? true : undefined}
      data-lane={role}
      className={neighbor ? `pointer-events-none absolute inset-y-0 w-full ${role === 'prev' ? '-left-full' : 'left-full'}` : 'relative'}
    >
      <div
        className={`pb-[calc(var(--nav-bottom)+98px+var(--subnav-space,0px))] ${neighbor ? 'sticky top-0 h-dvh overflow-hidden bg-bg [content-visibility:auto]' : ''}`}
      >
        <PaneActiveContext.Provider value={role === 'current'}>
          <LanePage pageKey={key} />
        </PaneActiveContext.Provider>
      </div>
    </div>
  );
}

/**
 * memo: Shell перерисовывается при каждом переходе и смене соседей — страница при этом не должна перерисовываться целиком.
 */
const LanePage = memo(function LanePage({ pageKey: key }: { pageKey: PageKey }) {
  const { tab, mode } = parsePage(key);
  switch (tab) {
    case 'today':
      return <Today />;
    case 'money':
      return <Money />;
    case 'tasks':
      return <Tasks mode={mode as TasksMode} />;
    case 'goals':
      return <Goals />;
    case 'reports':
      return (
        <Suspense fallback={null}>
          <Reports mode={mode as ReportsMode} />
        </Suspense>
      );
  }
});

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
