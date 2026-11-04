import { Component, useState, type ReactNode } from 'react';
import { saveBackup } from '../data/backup';

/**
 * Любая ошибка рендера или чтения базы — не пустой экран, а объяснение и выход:
 * сохранить бэкап (данные есть только на телефоне) и перезапустить.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    return this.state.error ? <Crash error={this.state.error} /> : this.props.children;
  }
}

function Crash({ error }: { error: Error }) {
  const [status, setStatus] = useState<string | null>(null);
  const backup = async () => {
    try {
      const result = await saveBackup();
      setStatus(
        result === 'shared'
          ? 'Бэкап сохранён.'
          : result === 'downloaded'
            ? 'Файл скачан — проверьте «Файлы» → «Загрузки».'
            : 'Сохранение отменено.',
      );
    } catch (e) {
      setStatus(`Бэкап не получился: ${(e as Error).message}`);
    }
  };
  return (
    <main role="alert" className="pt-safe mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4">
      <h1 className="text-h1 font-bold">Что-то сломалось</h1>
      <p className="text-muted">Данные на месте. Сохраните бэкап и перезапустите приложение.</p>
      <p className="rounded-ctl bg-surface p-3 text-caption break-words text-muted">{error.message}</p>
      <button
        type="button"
        onClick={() => void backup()}
        className="min-h-12 rounded-card bg-primary px-4 font-semibold text-white active:opacity-80"
      >
        Сохранить бэкап
      </button>
      <button
        type="button"
        onClick={() => location.reload()}
        className="min-h-12 rounded-card bg-surface px-4 font-semibold text-ink ring-1 ring-line active:opacity-80"
      >
        Перезапустить
      </button>
      {status && <p aria-live="polite" className="text-center text-caption">{status}</p>}
    </main>
  );
}
