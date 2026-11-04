import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

/** Реактивный запрос к Dexie: перезапускается, когда меняются прочитанные таблицы. */
export function useLiveQuery<T>(query: () => Promise<T>, deps: readonly unknown[] = []): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: setValue,
      error: (e: unknown) => console.error(e),
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
