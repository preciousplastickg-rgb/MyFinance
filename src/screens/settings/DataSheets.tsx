import { useState } from 'react';
import { deleteAll, hasData, replaceAll, saveBackup } from '../../data/backup';
import type { Backup } from '../../domain/backup';
import { Button, Field, TextInput } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

/** Превью импорта и «Заменить всё»: текущие данные сначала сохраняются (SPEC 8). */
export function ImportSheet({ backup, summary, onClose }: { backup: Backup; summary: string; onClose: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      if (await hasData()) {
        const saved = await saveBackup();
        if (!saved) {
          toast({ message: 'Импорт отменён: сначала сохраните текущие данные' });
          return setBusy(false);
        }
      }
      await replaceAll(backup);
      onClose();
      toast({ message: 'Данные восстановлены из бэкапа' });
    } catch (e) {
      setBusy(false);
      toast({ message: `Не получилось: ${(e as Error).message}` });
    }
  };
  return (
    <Sheet title="Импорт бэкапа" onClose={onClose}>
      <div className="space-y-4">
        <p className="tabular rounded-ctl bg-bg p-3">{summary}</p>
        <p className="text-caption text-muted">
          Все текущие данные будут заменены. Перед заменой они автоматически сохранятся в файл — выберите «Сохранить в Файлы».
        </p>
        <Button className="w-full" disabled={busy} onClick={() => void run()}>
          Заменить всё
        </Button>
      </div>
    </Sheet>
  );
}

/** Удаление всех данных: подтверждение словом «УДАЛИТЬ» и автоэкспорт перед удалением (SPEC 8). */
export function DeleteAllSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = word.trim().toUpperCase() === 'УДАЛИТЬ';
  const run = async () => {
    setBusy(true);
    try {
      if (await hasData()) {
        const saved = await saveBackup();
        if (!saved) {
          toast({ message: 'Удаление отменено: бэкап не сохранён' });
          return setBusy(false);
        }
      }
      await deleteAll();
      onClose();
      toast({ message: 'Все данные удалены' });
    } catch (e) {
      setBusy(false);
      toast({ message: `Не получилось: ${(e as Error).message}` });
    }
  };
  return (
    <Sheet title="Удалить все данные" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-muted">Счета, операции, регулярные платежи и дела будут удалены. Перед удалением сохранится бэкап.</p>
        <Field label="Для подтверждения введите УДАЛИТЬ">
          {(id) => <TextInput id={id} value={word} onChange={(e) => setWord(e.target.value)} autoCapitalize="characters" autoComplete="off" />}
        </Field>
        <Button variant="danger" className="w-full" disabled={!ready || busy} onClick={() => void run()}>
          Удалить всё
        </Button>
      </div>
    </Sheet>
  );
}
