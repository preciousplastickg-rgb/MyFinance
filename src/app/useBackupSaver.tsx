import { useRef, useState, type ReactNode } from 'react';
import { markBackupSaved, saveBackup } from '../data/backup';
import { Button } from '../ui/controls';
import { Sheet } from '../ui/Sheet';

/**
 * Сохранение бэкапа с проверкой: если «Поделиться» недоступно и файл скачан ссылкой,
 * спрашиваем, сохранился ли он. Без «да» бэкап не считается сделанным — импорт и удаление не идут дальше.
 */
export function useBackupSaver(): { save: () => Promise<boolean>; sheet: ReactNode } {
  const [asking, setAsking] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const answer = (ok: boolean) => {
    setAsking(false);
    resolver.current?.(ok);
    resolver.current = null;
  };

  const save = async (): Promise<boolean> => {
    const result = await saveBackup();
    if (result !== 'downloaded') return result === 'shared';
    setAsking(true);
    const ok = await new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
    if (ok) await markBackupSaved();
    return ok;
  };

  const sheet = asking ? (
    <Sheet title="Файл сохранился?" onClose={() => answer(false)}>
      <div className="space-y-4">
        <p className="text-muted">
          Меню «Поделиться» недоступно, поэтому бэкап скачан ссылкой. Проверьте, что файл есть в «Файлах» → «Загрузки».
        </p>
        <Button className="w-full" onClick={() => answer(true)}>
          Файл сохранён
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => answer(false)}>
          Не сохранился
        </Button>
      </div>
    </Sheet>
  ) : null;

  return { save, sheet };
}
