import { Settings as SettingsIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useNav, useToday } from '../app/nav';
import { useData } from '../data/DataProvider';
import { formatDayHeader } from '../domain/date';
import { dailyLimit, occurrences, todayAgenda } from '../domain/recurring';
import { AccountsStrip } from '../ui/AccountsStrip';
import { ScreenHeader } from '../ui/ScreenHeader';
import { BackupBanner } from './today/BackupBanner';
import { LimitCard } from './today/LimitCard';
import { PaymentsSection } from './today/PaymentsSection';
import { HabitsBlock } from './today/HabitsBlock';
import { TasksBlock } from './today/TasksBlock';

export function Today() {
  const today = useToday();
  const { push } = useNav();
  const data = useData();

  const occ = useMemo(() => occurrences(data.recurring, data.occurrenceLog, today), [data.recurring, data.occurrenceLog, today]);
  const limit = useMemo(
    () =>
      dailyLimit({
        today,
        accounts: data.accounts,
        balances: data.balances,
        transactions: data.transactions,
        occurrences: occ,
        usdtRate: data.settings.lastUsdtRate,
      }),
    [today, data.accounts, data.balances, data.transactions, occ, data.settings.lastUsdtRate],
  );
  const agenda = todayAgenda(occ, today, limit.horizon);

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
        <BackupBanner />
        <LimitCard limit={limit} />
        <AccountsStrip />
        <PaymentsSection payments={agenda.payments} incomes={agenda.incomes} />
        <TasksBlock />
        <HabitsBlock />
      </div>
    </>
  );
}
