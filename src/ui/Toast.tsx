import { Check } from 'lucide-react';
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

/** Тост над меню: новый заменяет старый; с «Отменить» живёт 5 с, без — 3 с (HANDOFF, «Оболочка»). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Shown | null>(null);
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismiss = useCallback(() => setToast(null), []);

  const show = useCallback(
    (options: ToastOptions) => {
      counter.current += 1;
      const id = counter.current;
      setToast({ ...options, id });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast((t) => (t?.id === id ? null : t)), options.duration ?? (options.actionLabel ? 5000 : 3000));
    },
    [],
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
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 z-[70] flex justify-center" style={{ bottom: 'calc(var(--nav-bottom) + 78px)' }}>
        {toast && (
          <div
            key={toast.id}
            role="status"
            className="toast pointer-events-auto flex min-h-[52px] w-full max-w-lg items-center gap-3 rounded-ctl bg-ink py-1 pr-2 pl-4 text-bg shadow-[0_8px_24px_rgba(0,0,0,.2)]"
          >
            <Check size={18} className="shrink-0" aria-hidden />
            <span className="tabular flex-1 text-[14px] font-medium">{toast.message}</span>
            {toast.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.();
                  dismiss();
                }}
                className="min-h-10 shrink-0 px-2.5 text-[14px] font-bold text-toast-action"
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
