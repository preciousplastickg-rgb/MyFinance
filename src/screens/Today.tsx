import { Settings as SettingsIcon } from 'lucide-react';
import { useNav, useToday } from '../app/nav';
import { formatDayHeader } from '../domain/date';
import { AccountsStrip } from '../ui/AccountsStrip';
import { Placeholder } from '../ui/Placeholder';
import { ScreenHeader } from '../ui/ScreenHeader';

export function Today() {
  const today = useToday();
  const { push } = useNav();

  return (
    <>
      <ScreenHeader
        title="Сегодня"
        subtitle={formatDayHeader(today)}
        action={
          <button
            type="button"
            onClick={() => push({ name: 'settings' })}
            aria-label="Настройки"
            className="-mr-2 flex size-11 items-center justify-center rounded-full text-ink active:bg-line"
          >
            <SettingsIcon size={24} strokeWidth={1.75} aria-hidden />
          </button>
        }
      />
      <div className="space-y-6 px-5">
        <section className="rounded-[20px] bg-primary p-5 text-white">
          <p className="text-caption text-white/75">Можно тратить сегодня</p>
          <p className="tabular mt-1 text-limit font-bold">—</p>
          <p className="mt-3 text-caption text-white/75">Лимит на день появится вместе с регулярными платежами.</p>
        </section>
        <AccountsStrip />
        <Placeholder title="Платежи до поступления" text="Регулярные платежи и доходы — этап 5." />
      </div>
    </>
  );
}
