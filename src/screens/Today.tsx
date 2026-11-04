import { Settings as SettingsIcon } from 'lucide-react';
import { formatDayHeader, toLocalDate } from '../domain/date';
import { Placeholder } from '../ui/Placeholder';
import { ScreenHeader } from '../ui/ScreenHeader';

export function Today({ onOpenSettings }: { onOpenSettings: () => void }) {
  const today = toLocalDate(Date.now());

  return (
    <>
      <ScreenHeader
        title="Сегодня"
        subtitle={formatDayHeader(today)}
        action={
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Настройки"
            className="-mr-2 flex size-11 items-center justify-center rounded-full text-ink active:bg-line"
          >
            <SettingsIcon size={24} strokeWidth={1.75} aria-hidden />
          </button>
        }
      />
      <div className="space-y-4 px-5">
        <section className="rounded-[20px] bg-primary p-5 text-white">
          <p className="text-caption text-white/75">Можно тратить сегодня</p>
          <p className="tabular mt-1 text-limit font-bold">—</p>
          <p className="mt-3 text-caption text-white/75">Лимит на день появится, когда будут счета и доходы.</p>
        </section>
        <Placeholder title="Счета" text="Здесь будет лента счетов — этап 2." />
        <Placeholder title="Платежи до поступления" text="Регулярные платежи и доходы — этап 5." />
      </div>
    </>
  );
}
