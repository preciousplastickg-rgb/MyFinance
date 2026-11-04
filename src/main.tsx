import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { db, ensureBaseCategories, ensureSettings } from './db';
import { requestPersistentStorage } from './db/persist';
import './index.css';

registerSW({ immediate: true });
void requestPersistentStorage();

async function start() {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('seed')) {
    const { seedDatabase } = await import('./dev/seed');
    await seedDatabase(db);
    history.replaceState(null, '', location.pathname);
  }
  await ensureSettings(db);
  await ensureBaseCategories(db);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
