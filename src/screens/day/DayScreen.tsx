import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNav, useToday } from '../../app/nav';
import { deleteTransaction, unskipOccurrence } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { BASE_CURRENCY } from '../../domain/currency';
import { dayPayments, dayTasks } from '../../domain/day';
import { addDays, formatDayTitle } from '../../domain/date';
import { monthTotals, totalExpenseKgs } from '../../domain/history';
import { formatMoney } from '../../domain/money';
import type { Occurrence } from '../../domain/recurring';
import type { Transaction } from '../../domain/types';
import { Button } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { SubScreen } from '../../ui/SubScreen';
import { useToast } from '../../ui/Toast';
import { TransactionRow } from '../../ui/TransactionRow';
import { TransactionEditor } from '../entry/TransactionEditor';
import { HabitList, useHabitViews } from '../habits/HabitsView';
import { TaskGroup } from '../tasks/TaskList';
import { OccurrenceSheet } from '../today/OccurrenceSheet';
import { DayCalendar } from './DayCalendar';

/** Итог выбранного дня: деньги, платежи, дела, привычки. Отмечать можно прямо здесь. */
export function DayScreen({ date: initial }: { date: string }) {
  const today = useToday();
  const data = useData();
  const { openEntry } = useNav();
  const toast = useToast();
  const [date, setDate] = useState(initial);
  const [calendar, setCalendar] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [occurrence, setOccurrence] = useState<Occurrence | null>(null);

  const txs = useMemo(
    () => data.transactions.filter((t) => t.date === date).sort((a, b) => b.createdAt - a.createdAt),
    [data.transactions, date],
  );
  const totals = useMemo(() => monthTotals(txs, data.accountById, data.rates), [txs, data.accountById, data.rates]);
  const expense = totalExpenseKgs(totals);
  const income = totals.income + totals.foreign.reduce((s, f) => s + f.incomeKgs, 0);
  const approx = totals.foreign.length > 0;
  const payments = useMemo(() => dayPayments(data.recurring, data.occurrenceLog, date), [data.recurring, data.occurrenceLog, date]);
  const tasks = useMemo(() => dayTasks(data.tasks, data.taskEvents, date), [data.tasks, data.taskEvents, date]);
  const habits = useHabitViews().filter((v) => v.habit.startDate <= date);
  const future = date > today;

  return (
    <SubScreen
      title={formatDayTitle(date, today)}
      back="Сегодня"
      action={
        <button type="button" onClick={() => setCalendar(true)} aria-label="Выбрать день" className="flex size-11 items-center justify-center text-accent">
          <CalendarDays size={22} aria-hidden />
        </button>
      }
    >
      {/* Листать дни — двумя широкими кнопками: достаёт большой палец любой руки. */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setDate(addDays(date, -1))} className="flex items-center justify-center gap-1">
          <ChevronLeft size={18} aria-hidden /> Предыдущий
        </Button>
        <Button variant="secondary" onClick={() => setDate(addDays(date, 1))} className="flex items-center justify-center gap-1">
          Следующий <ChevronRight size={18} aria-hidden />
        </Button>
      </div>

      <section className="space-y-2" aria-label="Деньги за день">
        <h2 className="px-1 text-h2 font-semibold">Деньги</h2>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card bg-line">
          <div className="bg-surface p-4">
            <p className="text-caption text-muted">Расходы</p>
            <p className={`tabular text-h2 font-semibold ${expense ? '' : 'text-muted'}`}>
              {expense ? '−' : ''}
              {approx && expense ? '≈ ' : ''}
              {formatMoney(expense, BASE_CURRENCY)}
            </p>
          </div>
          <div className="bg-surface p-4">
            <p className="text-caption text-muted">Доходы</p>
            <p className={`tabular text-h2 font-semibold ${income ? 'text-income' : 'text-muted'}`}>
              {income ? '+' : ''}
              {approx && income ? '≈ ' : ''}
              {formatMoney(income, BASE_CURRENCY)}
            </p>
          </div>
        </div>
        {txs.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface" aria-label="Операции дня">
            {txs.map((t) => (
              <li key={t.id}>
                <TransactionRow tx={t} onClick={() => setEditing(t)} />
              </li>
            ))}
          </ul>
        )}
        <Button variant="secondary" className="flex w-full items-center justify-center gap-1.5" onClick={() => openEntry({ date })}>
          <Plus size={18} aria-hidden /> Запись на этот день
        </Button>
      </section>

      {payments.length > 0 && (
        <section className="space-y-2" aria-label="Платежи дня">
          <h2 className="px-1 text-h2 font-semibold">Платежи</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface">
            {payments.map((o) => (
              <PaymentLine
                key={o.key}
                o={o}
                future={future}
                onMark={() => setOccurrence(o)}
                onUnskip={() => {
                  const log = data.occurrenceLog.find((l) => l.recurringId === o.recurring.id && l.dueDate === o.dueDate && l.status === 'skipped');
                  if (log) void unskipOccurrence(log.id);
                }}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2" aria-label="Дела дня">
        <h2 className="px-1 text-h2 font-semibold">Дела</h2>
        {/* Сделанное — тем же списком, что «Выполненные»: галочкой можно вернуть (этап 18). */}
        {tasks.done.length > 0 && (
          <div aria-label="Сделано в этот день" role="group">
            <TaskGroup tasks={tasks.done} swipe={false} />
          </div>
        )}
        <TaskGroup title={tasks.done.length ? (date < today ? 'Не сделано' : 'Запланировано') : undefined} tasks={tasks.open} />
        {tasks.done.length === 0 && tasks.open.length === 0 && (
          <p className="rounded-card bg-surface px-4 py-4 text-caption text-muted">{future ? 'На этот день дел нет' : 'В этот день дел не было'}</p>
        )}
      </section>

      {!future && habits.length > 0 && (
        <section className="space-y-2" aria-label="Привычки дня">
          <h2 className="px-1 text-h2 font-semibold">Привычки</h2>
          <HabitList views={habits} date={date} />
        </section>
      )}

      {calendar && <DayCalendar value={date} today={today} onPick={setDate} onClose={() => setCalendar(false)} />}
      {editing && <TransactionEditor tx={editing} onClose={() => setEditing(null)} />}
      {occurrence && (
        <OccurrenceSheet
          occurrence={occurrence}
          onDone={(tx) =>
            toast({ message: `${occurrence.recurring.name}: записано`, actionLabel: 'Отменить', onAction: () => void deleteTransaction(tx.id) })
          }
          onSkipped={(logId) => toast({ message: `${occurrence.recurring.name}: пропущено`, actionLabel: 'Отменить', onAction: () => void unskipOccurrence(logId) })}
          onClose={() => setOccurrence(null)}
        />
      )}
    </SubScreen>
  );
}

function PaymentLine({ o, future, onMark, onUnskip }: { o: Occurrence; future: boolean; onMark: () => void; onUnskip: () => void }) {
  const { categoryById } = useData();
  const category = categoryById.get(o.recurring.categoryId);
  const income = o.recurring.kind === 'income';
  const status =
    o.status === 'done' ? (income ? 'Пришло' : 'Оплачено') : o.status === 'skipped' ? 'Пропущено' : future ? 'Ожидается' : 'Не отмечено';
  return (
    <li className="flex min-h-14 items-center gap-3 py-2 pr-2 pl-4">
      <IconCircle name={category?.icon ?? 'Repeat'} color={category?.color ?? '#5B6170'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{o.recurring.name}</span>
        <span className={`tabular block text-caption ${o.status === 'done' ? 'text-income' : o.status === 'pending' && !future ? 'text-warn' : 'text-muted'}`}>
          {status} · {formatMoney(o.recurring.amount, o.recurring.currency)}
        </span>
      </span>
      {o.status === 'pending' && (
        <button
          type="button"
          onClick={onMark}
          aria-label={`Отметить: ${o.recurring.name}`}
          className="min-h-11 shrink-0 rounded-ctl bg-surface px-3 text-caption font-semibold text-accent ring-1 ring-accent/40 active:bg-bg"
        >
          Отметить
        </button>
      )}
      {o.status === 'skipped' && (
        <button type="button" onClick={onUnskip} className="min-h-11 shrink-0 px-3 text-caption font-semibold text-accent">
          Вернуть
        </button>
      )}
    </li>
  );
}
