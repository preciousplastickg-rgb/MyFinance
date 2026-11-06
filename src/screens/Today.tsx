import { ChevronDown, Settings as SettingsIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useIncomeTimePassed, useNav, useToday } from '../app/nav';
import { useData } from '../data/DataProvider';
import { formatDayHeader, formatShortDate, weekdayOf } from '../domain/date';
import { dailyLimit, INCOME_MINUTES, occurrences, todayAgenda } from '../domain/recurring';
import { AccountsStrip } from '../ui/AccountsStrip';
import { ScreenHeader } from '../ui/ScreenHeader';
import { DayCalendar } from './day/DayCalendar';
import { BackupBanner } from './today/BackupBanner';
import { DebtsStrip } from './today/DebtsStrip';
import { SavingsStrip } from './today/SavingsStrip';
import { LimitCard } from './today/LimitCard';
import { PaymentsSection } from './today/PaymentsSection';
import { HabitsBlock } from './today/HabitsBlock';
import { TasksBlock } from './today/TasksBlock';

const WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

export function Today() {
  const today = useToday();
  const incomeTimePassed = useIncomeTimePassed();
  const { push } = useNav();
  const data = useData();
  const [calendar, setCalendar] = useState(false);
  const weekday = WEEKDAYS[weekdayOf(today) - 1];

  const occ = useMemo(() => occurrences(data.recurring, data.occurrenceLog, today), [data.recurring, data.occurrenceLog, today]);
  const limit = useMemo(
    () =>
      dailyLimit({
        today,
        nowMinutes: incomeTimePassed ? INCOME_MINUTES : 0,
        accounts: data.accounts,
        balances: data.balances,
        transactions: data.transactions,
        occurrences: occ,
        rateFor: data.rateFor,
      }),
    [today, incomeTimePassed, data.accounts, data.balances, data.transactions, occ, data.rateFor],
  );
  const agenda = todayAgenda(occ, today, limit.horizon);

  return (
    <>
      {/* Вместо слова «Сегодня» — дата; тап открывает календарь, выбранный день — итог дня. */}
      <ScreenHeader
        subtitle={weekday}
        title={
          <button
            type="button"
            onClick={() => setCalendar(true)}
            aria-label={`${formatDayHeader(today)}. Выбрать день`}
            className="-ml-1 flex min-h-11 items-center gap-1.5 rounded-ctl px-1 text-left active:bg-line"
          >
            {formatShortDate(today)}
            <ChevronDown size={22} strokeWidth={2.25} className="text-muted" aria-hidden />
          </button>
        }
        action={
          <button
            type="button"
            onClick={() => push({ name: 'settings' })}
            aria-label="Настройки"
            className="-mr-2 flex size-11 items-center justify-center rounded-ctl text-ink active:bg-line"
          >
            <SettingsIcon size={24} strokeWidth={1.75} aria-hidden />
          </button>
        }
      />
      <div className="space-y-4 px-4">
        <BackupBanner />
        <LimitCard limit={limit} />
        {/* Порядок — выбор пользователя: деньги (счета, копилка, долги, платежи), потом дела и привычки. */}
        <AccountsStrip />
        <SavingsStrip />
        <DebtsStrip />
        <PaymentsSection payments={agenda.payments} incomes={agenda.incomes} mandatory={limit.mandatory} />
        <TasksBlock />
        <HabitsBlock />
      </div>
      {calendar && (
        <DayCalendar value={today} today={today} onPick={(d) => d !== today && push({ name: 'day', date: d })} onClose={() => setCalendar(false)} />
      )}
    </>
  );
}
