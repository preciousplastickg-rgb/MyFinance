import { useEffect } from 'react';
import { NavProvider, useNav, type Screen } from './app/nav';
import { useTabSwipe } from './app/useTabSwipe';
import { DataProvider, useData } from './data/DataProvider';
import { Money } from './screens/Money';
import { Onboarding } from './screens/Onboarding';
import { QuickEntry } from './screens/QuickEntry';
import { RecurringScreen } from './screens/recurring/RecurringScreen';
import { Reports } from './screens/Reports';
import { Settings } from './screens/Settings';
import { AccountsScreen } from './screens/settings/AccountsScreen';
import { CategoriesScreen } from './screens/settings/CategoriesScreen';
import { Tasks } from './screens/Tasks';
import { Today } from './screens/Today';
import { AreasScreen } from './screens/settings/AreasScreen';
import { RatesScreen } from './screens/settings/RatesScreen';
import { BottomNav } from './ui/BottomNav';
import { ToastProvider } from './ui/Toast';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import { UpdatePrompt } from './app/UpdatePrompt';

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
      return <RecurringScreen />;
    case 'subscriptions':
      return <RecurringScreen subscriptionsOnly />;
    default:
      return null;
  }
}

const THEME_COLOR = { light: '#F4F5F7', dark: '#0B1220' };

/** Тема из настроек: data-theme на <html>, «системная» — через prefers-color-scheme в CSS. */
function useTheme(theme: 'light' | 'dark' | 'system') {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

function Shell() {
  const { settings, accounts } = useData();
  const { tab, setTab, stack, entry, closeEntry } = useNav();
  useTheme(settings.theme);
  const swipe = useTabSwipe(tab, setTab);

  if (!settings.onboardingDone && accounts.length === 0) return <Onboarding />;

  const top = stack[stack.length - 1];
  return (
    <>
      {top ? (
        <StackScreen key={stack.length} screen={top} />
      ) : (
        <>
          {/* Жест ловит неподвижная обёртка: страница под пальцем может быть сдвинута. */}
          <div {...swipe.handlers} className="min-h-dvh touch-pan-y overflow-x-hidden">
          <main
            key={swipe.enter?.key}
            className={`pb-[calc(var(--nav-height)+env(safe-area-inset-bottom)+24px)] ${swipe.settling && !swipe.offset ? 'transition-transform duration-150' : ''} ${
              swipe.enter && !swipe.offset ? (swipe.enter.from === 1 ? 'tab-enter-right' : 'tab-enter-left') : ''
            }`}
            style={{ transform: swipe.offset ? `translateX(${swipe.offset}px)` : undefined }}
          >
            {tab === 'today' && <Today />}
            {tab === 'money' && <Money />}
            {tab === 'tasks' && <Tasks />}
            {tab === 'reports' && <Reports />}
          </main>
          </div>
          <BottomNav />
        </>
      )}
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
