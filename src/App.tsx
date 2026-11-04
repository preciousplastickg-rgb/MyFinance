import { useState } from 'react';
import { BottomNav, type Tab } from './ui/BottomNav';
import { QuickEntry } from './screens/QuickEntry';
import { Reports } from './screens/Reports';
import { Money } from './screens/Money';
import { Settings } from './screens/Settings';
import { Today } from './screens/Today';

export function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);

  if (settingsOpen) return <Settings onBack={() => setSettingsOpen(false)} />;

  return (
    <>
      <main className="pb-[calc(var(--nav-height)+env(safe-area-inset-bottom)+16px)]">
        {tab === 'today' && <Today onOpenSettings={() => setSettingsOpen(true)} />}
        {tab === 'money' && <Money />}
        {tab === 'reports' && <Reports />}
      </main>
      <BottomNav active={tab} onSelect={setTab} onAdd={() => setEntryOpen(true)} />
      {entryOpen && <QuickEntry onClose={() => setEntryOpen(false)} />}
    </>
  );
}
