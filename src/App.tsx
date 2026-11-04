import { NavProvider, useNav, type Screen } from './app/nav';
import { DataProvider, useData } from './data/DataProvider';
import { Money } from './screens/Money';
import { Onboarding } from './screens/Onboarding';
import { QuickEntry } from './screens/QuickEntry';
import { RecurringScreen } from './screens/recurring/RecurringScreen';
import { Reports } from './screens/Reports';
import { Settings } from './screens/Settings';
import { AccountsScreen } from './screens/settings/AccountsScreen';
import { CategoriesScreen } from './screens/settings/CategoriesScreen';
import { Today } from './screens/Today';
import { BottomNav } from './ui/BottomNav';
import { ToastProvider } from './ui/Toast';

function StackScreen({ screen }: { screen: Screen }) {
  switch (screen.name) {
    case 'settings':
      return <Settings />;
    case 'accounts':
      return <AccountsScreen />;
    case 'categories':
      return <CategoriesScreen />;
    case 'recurring':
      return <RecurringScreen />;
    case 'subscriptions':
      return <RecurringScreen subscriptionsOnly />;
    default:
      return null;
  }
}

function Shell() {
  const { settings, accounts } = useData();
  const { tab, stack, entry, closeEntry } = useNav();

  if (!settings.onboardingDone && accounts.length === 0) return <Onboarding />;

  const top = stack[stack.length - 1];
  return (
    <>
      {top ? (
        <StackScreen key={stack.length} screen={top} />
      ) : (
        <>
          <main className="pb-[calc(var(--nav-height)+env(safe-area-inset-bottom)+24px)]">
            {tab === 'today' && <Today />}
            {tab === 'money' && <Money />}
            {tab === 'reports' && <Reports />}
          </main>
          <BottomNav />
        </>
      )}
      {entry && <QuickEntry onClose={closeEntry} />}
    </>
  );
}

export function App() {
  return (
    <ToastProvider>
      <NavProvider>
        <DataProvider>
          <Shell />
        </DataProvider>
      </NavProvider>
    </ToastProvider>
  );
}
