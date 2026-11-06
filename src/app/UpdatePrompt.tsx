import { RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Как часто проверять новую версию, пока приложение открыто. */
const CHECK_EVERY_MS = 30 * 60 * 1000;

/**
 * Плашка «Доступна новая версия»: новый service worker ждёт, пока пользователь не нажмёт «Обновить».
 * Проверка — при запуске, при возврате в приложение и раз в 30 минут.
 */
export function UpdatePrompt() {
  const [updating, setUpdating] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => {
        if (navigator.onLine && !reg.installing) reg.update().catch(() => {});
      };
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  if (!needRefresh) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4" style={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}>
      <div
        role="alert"
        aria-label="Доступна новая версия"
        className="toast pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-3 rounded-card bg-primary py-1 pr-1 pl-4 text-white shadow-lg"
      >
        <RefreshCw size={18} className={`shrink-0 ${updating ? 'animate-spin' : ''}`} aria-hidden />
        <span className="flex-1 text-body">Доступна новая версия</span>
        <button
          type="button"
          disabled={updating}
          onClick={() => {
            setUpdating(true);
            void updateServiceWorker(true);
          }}
          className="min-h-11 shrink-0 rounded-ctl px-3 font-semibold text-toast-action active:bg-white/10"
        >
          Обновить
        </button>
        <button
          type="button"
          aria-label="Позже"
          onClick={() => setNeedRefresh(false)}
          className="flex size-11 shrink-0 items-center justify-center rounded-ctl text-white/70 active:bg-white/10"
        >
          <X size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
