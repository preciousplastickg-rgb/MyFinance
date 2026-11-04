import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { db, ensureSettings } from './db';
import { requestPersistentStorage } from './db/persist';
import './index.css';

registerSW({ immediate: true });
void ensureSettings(db);
void requestPersistentStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
