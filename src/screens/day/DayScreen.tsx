import { CalendarDays, ChevronLeft, ChevronRight, Plus } from '../../ui/glyphs';
import { useMemo, useState } from 'react';
import { useNav, useToday } from '../../app/nav';
import { deleteTransaction, unskipOccurrence } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { dayPayments, dayTasks } from '../../domain/day';
import { addDays, formatDayHeader, formatDayTitle, formatShortDate } from '../../domain/date';
import { monthTotals, totalExpenseKgs } from '../../domain/history';
import { formatAmount, formatMoney, roundToSom } from '../../domain/money';
import type { Occurrence } from '../../domain/recurring';
import type { Transaction } from '../../domain/types';
import { IconCircle } from '../../ui/icons';
import { SubScreen } from '../../ui/SubScreen';
import { useToast } from '../../ui/Toast';
import { TransactionRow } from '../../ui/TransactionRow';
import { TransactionEditor } from '../entry/TransactionEditor';
import { HabitList, useHabitViews } from '../habits/HabitsView';
import { TaskGroup } from '../tasks/TaskList';
import { OccurrenceSheet } from '../today/OccurrenceSheet';
import { DayCalendar } from './DayCalendar';

/** «Сегодня» / «Вчера» / «Завтра» / день недели — подпись над датой. */
function dayWord(date: string, today: string): string {
  const title = formatDayTitle(date, today);
  return title.startsWith('Сегодня') || title.startsWith('Вчера') || title.startsWith('Завтра') ? title.split(',')[0]! : formatDayHeader(date).split(',')[0]!;
}

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
  // Плитки дня: до целого сома, длинная сумма — шрифтом меньше (как в «Деньгах»).
  const expenseText = formatAmount(roundToSom(expense));
  const incomeText = formatAmount(roundToSom(income));
  const tileSize = Math.max(expenseText.length, incomeText.length) > 9 ? 'text-[16px]' : 'text-[19px]';

  return (
    <SubScreen
      title={formatShortDate(date)}
      subtitle={undefined}
      hero={
        <div className="px-5 pt-1 pb-3.5">
          <p className="text-caption text-muted">{dayWord(date, today)}</p>
          <h1 className="text-h1 font-semibold">{formatShortDate(date)}</h1>
        </div>
      }
      back="Сегодня"
      action={
        <button type="button" onClick={() => setCalendar(true)} aria-label="Выбрать день" className="flex size-11 items-center justify-center text-accent">
          <CalendarDays size={22} aria-hidden />
        </button>
      }
    >
      <section className="space-y-2" aria-label="Деньги за день">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="card min-w-0 rounded-[20px] px-3.5 py-3">
            <p className="text-caption text-muted">Расходы</p>
            <p className={`display-num ${tileSize} ${expense ? '' : 'text-muted'}`}>
              {expense ? '−' : ''}
              {approx && expense ? '≈ ' : ''}
              {expenseText}
            </p>
          </div>
          <div className="card min-w-0 rounded-[20px] px-3.5 py-3">
            <p className="text-caption text-muted">Доходы</p>
            <p className={`display-num ${tileSize} ${income ? 'text-income' : 'text-muted'}`}>
              {income ? '+' : ''}
              {approx && income ? '≈ ' : ''}
              {incomeText}
            </p>
          </div>
        </div>
        <h2 className="flex min-h-11 items-center px-1 text-h2 font-semibold">Операции</h2>
        <div className="card py-0.5">
          {txs.length > 0 ? (
            <ul className="divide-y divide-line" aria-label="Операции дня">
              {txs.map((t) => (
                <li key={t.id}>
                  <TransactionRow tx={t} onClick={() => setEditing(t)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-[18px] text-[14px] text-muted">В этот день записей нет</p>
          )}
          <button type="button" onClick={() => openEntry({ date })} className="flex min-h-[52px] w-full items-center gap-2.5 border-t border-line px-4 font-semibold text-accent">
            <Plus size={18} aria-hidden /> Запись на этот день
          </button>
        </div>
      </section>

      {payments.length > 0 && (
        <section className="space-y-2" aria-label="Платежи дня">
          <h2 className="px-1 text-h2 font-semibold">Платежи</h2>
          <ul className="card divide-y divide-line overflow-hidden py-0.5">
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
            <TaskGroup title="Сделано" titleClass="text-income" tasks={tasks.done} swipe={false} completed />
          </div>
        )}
        <TaskGroup title={tasks.done.length ? (date < today ? 'Не сделано' : 'Запланировано') : undefined} tasks={tasks.open} />
        {tasks.done.length === 0 && tasks.open.length === 0 && (
          <p className="card px-4 py-[18px] text-[14px] text-muted">{future ? 'На этот день дел нет' : 'В этот день дел не было'}</p>
        )}
      </section>

      {!future && habits.length > 0 && (
        <section className="space-y-2" aria-label="Привычки дня">
          <h2 className="px-1 text-h2 font-semibold">Привычки</h2>
          <HabitList views={habits} date={date} />
        </section>
      )}

      {/* Листать дни — двумя широкими кнопками: достаёт большой палец любой руки. */}
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => setDate(addDays(date, -1))} className="flex min-h-12 items-center justify-center gap-1 rounded-ctl bg-surface font-medium shadow-card">
          <ChevronLeft size={18} aria-hidden /> Предыдущий
        </button>
        <button type="button" onClick={() => setDate(addDays(date, 1))} className="flex min-h-12 items-center justify-center gap-1 rounded-ctl bg-surface font-medium shadow-card">
          Следующий <ChevronRight size={18} aria-hidden />
        </button>
      </div>

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
      <IconCircle name={category?.icon ?? 'Repeat'} color={category?.color ?? 'slate'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{o.recurring.name}</span>
        <span className={`tabular block text-caption ${o.status === 'done' ? 'text-income' : o.status === 'pending' && !future ? 'text-warn' : 'text-muted'}`}>
          {status} · {formatMoney(o.amount, o.recurring.currency)}
        </span>
      </span>
      {o.status === 'pending' && (
        <button
          type="button"
          onClick={onMark}
          aria-label={`Отметить: ${o.recurring.name}`}
          className="min-h-10 shrink-0 rounded-ctl px-3.5 text-[14px] font-semibold ring-[1.5px] ring-line ring-inset active:bg-sunk"
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
