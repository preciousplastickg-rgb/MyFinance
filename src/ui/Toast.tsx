import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

const ToastContext = createContext<(options: ToastOptions) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

type Shown = ToastOptions & { id: number };

const MAX_SHOWN = 3;

/** Несколько тостов друг над другом: второе «Оплачено» подряд не стирает «Отменить» у первого. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Shown[]>([]);
  const counter = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (options: ToastOptions) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((list) => [...list, { ...options, id }].slice(-MAX_SHOWN));
      // Без действия сообщение можно убрать раньше: ему незачем висеть 5 с поверх списка.
      setTimeout(() => dismiss(id), options.duration ?? (options.actionLabel ? 5000 : 3000));
    },
    [dismiss],
  );

  // Запись в базу без await (вызовы `void action()`) не должна проваливаться молча.
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason as { message?: unknown } | undefined;
      show({ message: `Не получилось: ${typeof reason?.message === 'string' ? reason.message : String(e.reason)}` });
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, [show]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4"
        style={{ bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom) + 12px)' }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="toast pointer-events-auto flex min-h-12 w-full max-w-md items-center justify-between gap-3 rounded-card bg-primary py-1 pr-1 pl-4 text-white shadow-lg"
          >
            <span className="tabular text-body">{toast.message}</span>
            {toast.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.();
                  dismiss(toast.id);
                }}
                className="min-h-11 shrink-0 rounded-ctl px-3 font-semibold text-[#9DB4FF] active:bg-white/10"
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
