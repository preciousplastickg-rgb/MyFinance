import { ChevronLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SCHEMA_VERSION } from '../db';
import { requestPersistentStorage, type StorageState } from '../db/persist';
import { ScreenHeader } from '../ui/ScreenHeader';

const STORAGE_TEXT: Record<StorageState, string> = {
  persisted: 'постоянное',
  'best-effort': 'может быть очищено системой',
  unsupported: 'нет данных',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 px-4 py-2.5">
      <span>{label}</span>
      <span className="text-right text-muted">{value}</span>
    </div>
  );
}

export function Settings({ onBack }: { onBack: () => void }) {
  const [storage, setStorage] = useState<StorageState | null>(null);
  const standalone = window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => {
    void requestPersistentStorage().then(setStorage);
  }, []);

  return (
    <>
      <div className="pt-safe px-2">
        <button
          type="button"
          onClick={onBack}
          className="mt-2 flex min-h-11 items-center gap-1 pr-3 text-body font-medium text-accent"
        >
          <ChevronLeft size={24} aria-hidden />
          Сегодня
        </button>
      </div>
      <ScreenHeader title="Настройки" />
      <div className="px-5">
        <h2 className="mb-2 px-1 text-caption text-muted">О приложении</h2>
        <div className="divide-y divide-line rounded-2xl bg-surface">
          <Row label="Версия" value={__APP_VERSION__} />
          <Row label="Схема данных" value={`v${SCHEMA_VERSION}`} />
          <Row label="Хранилище" value={storage ? STORAGE_TEXT[storage] : '…'} />
          <Row label="Запуск" value={standalone ? 'с экрана «Домой»' : 'в браузере'} />
        </div>
      </div>
    </>
  );
}
