import { ChevronDown, Moon, Settings as SettingsIcon, Sun } from '../ui/glyphs';
import { useMemo, useState } from 'react';
import { useIncomeTimePassed, useNav, useToday } from '../app/nav';
import { isDark } from '../app/useTheme';
import { originOf, switchTheme } from '../app/themeSwitch';
import { useData } from '../data/DataProvider';
import { formatDayHeader, formatShortDate, weekdayOf } from '../domain/date';
import { currencyTotals, moneyOverview } from '../domain/overview';
import { dailyLimit, INCOME_MINUTES, occurrences, upcomingAgenda } from '../domain/recurring';
import { AccountsStrip } from '../ui/AccountsStrip';
import { HeaderButton, ScreenHeader } from '../ui/ScreenHeader';
import { DayCalendar } from './day/DayCalendar';
import { BackupBanner } from './today/BackupBanner';
import { DebtsStrip } from './today/DebtsStrip';
import { GoalsStrip } from './today/GoalsStrip';
import { SavingsStrip } from './today/SavingsStrip';
import { MoneyCard } from './today/MoneyCard';
import { PaymentsSection } from './today/PaymentsSection';
import { HabitsBlock } from './today/HabitsBlock';
import { LimitsStrip } from './today/LimitsStrip';
import { HideAmountsButton } from '../ui/Secret';
import { TasksBlock } from './today/TasksBlock';

const WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

export function Today() {
  const today = useToday();
  const incomeTimePassed = useIncomeTimePassed();
  const { push } = useNav();
  const data = useData();
  const [calendar, setCalendar] = useState(false);
  const weekday = WEEKDAYS[weekdayOf(today) - 1];
  const dark = isDark(data.settings.theme);

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
  // Платежи на «Сегодня» — только те, срок которых подошёл (этап 29).
  const agenda = useMemo(() => upcomingAgenda(occ, today), [occ, today]);
  const currencies = useMemo(() => currencyTotals(data.accounts, data.balances, data.rateFor), [data.accounts, data.balances, data.rateFor]);
  const overview = useMemo(
    () => moneyOverview({ today, accounts: data.accounts, balances: data.balances, transactions: data.transactions, occurrences: occ, debts: data.debts, limit, rateFor: data.rateFor }),
    [today, data.accounts, data.balances, data.transactions, occ, data.debts, limit, data.rateFor],
  );

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
            className="flex min-h-11 items-center gap-1.5 text-left"
          >
            {formatShortDate(today)}
            <ChevronDown size={20} className="text-muted" aria-hidden />
          </button>
        }
        action={
          <>
            {/* Глаз — «Скрыть суммы» от чужих глаз (по просьбе пользователя). */}
            <HideAmountsButton />
            {/* Луна/солнце ставит явную тему; «как в системе» остаётся в настройках. */}
            <HeaderButton label={dark ? 'Светлая тема' : 'Тёмная тема'} onClick={(e) => void switchTheme(dark ? 'light' : 'dark', originOf(e.currentTarget))}>
              {dark ? <Sun size={22} strokeWidth={1.9} aria-hidden /> : <Moon size={22} strokeWidth={1.9} aria-hidden />}
            </HeaderButton>
            <HeaderButton label="Настройки" onClick={() => push({ name: 'settings' })}>
              <SettingsIcon size={22} strokeWidth={1.9} aria-hidden />
            </HeaderButton>
          </>
        }
      />
      <div className="space-y-4 px-4">
        <BackupBanner />
        <MoneyCard overview={overview} limit={limit} currencies={currencies} />
        {/* Порядок — выбор пользователя: деньги (счета, копилка, долги, платежи), потом дела и привычки. */}
        <AccountsStrip />
        <GoalsStrip />
        <SavingsStrip />
        <DebtsStrip />
        <LimitsStrip />
        <PaymentsSection payments={agenda.payments} incomes={agenda.incomes} />
        <TasksBlock />
        <HabitsBlock />
      </div>
      {calendar && (
        <DayCalendar value={today} today={today} onPick={(d) => d !== today && push({ name: 'day', date: d })} onClose={() => setCalendar(false)} />
      )}
    </>
  );
}
