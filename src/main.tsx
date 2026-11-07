import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { db, ensureBaseAreas, ensureBaseCategories, ensureSettings } from './db';
import { requestPersistentStorage } from './db/persist';
import './index.css';

void requestPersistentStorage();

async function start() {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('seed')) {
    const { seedDatabase } = await import('./dev/seed');
    await seedDatabase(db);
    history.replaceState(null, '', location.pathname);
  }
  // Три таблицы готовятся параллельно: каждая — своя транзакция, ждать их по очереди незачем.
  await Promise.all([ensureSettings(db), ensureBaseCategories(db), ensureBaseAreas(db)]);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

/**
 * База не открылась до старта React (приватный режим Safari, вычищенное хранилище, понижение версии схемы):
 * вместо белого экрана — объяснение и «Перезапустить». AppErrorBoundary здесь ещё не работает — React не смонтирован,
 * поэтому разметка собирается руками через DOM, без innerHTML.
 */
function showStartupError(error: unknown): void {
  console.error(error);
  const root = document.getElementById('root');
  if (!root) return;
  const el = (tag: string, text: string, style: string) => {
    const node = document.createElement(tag);
    node.textContent = text;
    node.style.cssText = style;
    return node;
  };
  const main = el('main', '', 'max-width:32rem;margin:0 auto;padding:max(24px,env(safe-area-inset-top)) 16px 24px;font:15px/1.4 system-ui,sans-serif;color:var(--ink,#181b1f)');
  main.setAttribute('role', 'alert');
  const button = el('button', 'Перезапустить', 'margin-top:16px;min-height:48px;padding:0 16px;border:0;border-radius:16px;font:inherit;font-weight:600;background:var(--primary,#21242a);color:var(--on-primary,#fff)');
  button.setAttribute('type', 'button');
  button.onclick = () => location.reload();
  main.append(
    el('h1', 'Не удалось открыть базу данных', 'margin:0 0 8px;font-size:22px;font-weight:700'),
    el('p', 'Данные хранятся в браузере на этом телефоне. Проверьте, что приложение открыто не в приватном режиме и на устройстве есть место, затем перезапустите.', 'margin:0 0 8px'),
    el('p', error instanceof Error ? `${error.name}: ${error.message}` : String(error), 'margin:0;opacity:.7;word-break:break-word'),
    button,
  );
  root.replaceChildren(main);
}

start().catch(showStartupError);
