import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

/**
 * Реактивный запрос к Dexie: перезапускается, когда меняются прочитанные таблицы.
 * Ошибка чтения бросается при рендере — её ловит AppErrorBoundary, а не вечный пустой экран.
 */
export function useLiveQuery<T>(query: () => Promise<T>, deps: readonly unknown[] = []): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  if (error) throw error;
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: setValue,
      error: (e: unknown) => {
        console.error(e);
        setError(e instanceof Error ? e : new Error(String(e)));
      },
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
