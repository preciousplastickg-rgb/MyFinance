import { ShieldAlert, X } from 'lucide-react';
import { useBackupSaver } from '../../app/useBackupSaver';
import { updateSettings } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { backupBanner } from '../../domain/backup';
import { useToast } from '../../ui/Toast';

/** «Последний бэкап 9 дней назад» + «Сохранить»; закрыть можно на 24 часа (SPEC 8). */
export function BackupBanner() {
  const { transactions, settings } = useData();
  const toast = useToast();
  const backup = useBackupSaver();
  const banner = backupBanner({
    transactionCount: transactions.length,
    lastBackupAt: settings.lastBackupAt,
    hiddenUntil: settings.backupBannerHiddenUntil,
    now: Date.now(),
  });
  if (!banner.show) return null;
  return (
    <section className="flex items-center gap-3 rounded-card bg-surface py-2 pr-1 pl-4 ring-1 ring-warn/40" aria-label="Бэкап">
      <ShieldAlert size={22} className="shrink-0 text-warn" aria-hidden />
      <p className="min-w-0 flex-1 text-caption font-medium">{banner.text}</p>
      <button
        type="button"
        onClick={() =>
          void backup
            .save()
            .then((ok) => ok && toast({ message: 'Бэкап сохранён' }))
            .catch((e: Error) => toast({ message: `Не получилось: ${e.message}` }))
        }
        className="min-h-11 shrink-0 rounded-ctl bg-primary px-3 text-caption font-semibold text-white"
      >
        Сохранить
      </button>
      <button
        type="button"
        aria-label="Скрыть на 24 часа"
        onClick={() => void updateSettings({ backupBannerHiddenUntil: Date.now() + 86_400_000 })}
        className="flex size-11 shrink-0 items-center justify-center text-muted"
      >
        <X size={20} aria-hidden />
      </button>
      {backup.sheet}
    </section>
  );
}
