import { Check, MoreHorizontal } from 'lucide-react';
import { useRef, useState, type PointerEvent } from 'react';
import { useNav, useToday } from '../../app/nav';
import { completeOccurrence } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { diffDays, formatRelativeDate } from '../../domain/date';
import { formatMoney } from '../../domain/money';
import { expectedKgs, type Occurrence } from '../../domain/recurring';
import { IconCircle } from '../../ui/icons';
import { OccurrenceSheet } from './OccurrenceSheet';

const SNOOZE_PREFIX = 'income-snooze:';

/** «Ещё нет» прячет карточку дохода до завтра. */
function snoozed(o: Occurrence, today: string): boolean {
  try {
    return localStorage.getItem(SNOOZE_PREFIX + o.key) === today;
  } catch {
    return false;
  }
}

function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      clear();
      timer.current = setTimeout(onLongPress, ms);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: { preventDefault: () => void }) => {
      e.preventDefault();
      clear();
      onLongPress();
    },
  };
}

function PaymentRow({ o, done, onPay, onMore }: { o: Occurrence; done: boolean; onPay: () => void; onMore: () => void }) {
  const { categoryById } = useData();
  const today = useToday();
  const category = categoryById.get(o.recurring.categoryId);
  const delta = diffDays(today, o.dueDate);
  const overdue = delta < 0;
  const warn = overdue || delta === 1;
  const press = useLongPress(onMore);
  return (
    <li className="flex min-h-16 items-center gap-2.5 py-2 pr-0.5 pl-4 select-none" {...press}>
      <IconCircle name={category?.icon ?? 'Repeat'} color={category?.color ?? '#5B6170'} />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug">{o.recurring.name}</p>
        <p className={`tabular text-caption ${warn && !done ? 'text-warn' : 'text-muted'}`}>
          {overdue ? `Просрочено, ${formatRelativeDate(o.dueDate, today).toLowerCase()}` : formatRelativeDate(o.dueDate, today)} ·{' '}
          {formatMoney(o.recurring.amount, o.recurring.currency)}
        </p>
      </div>
      {done ? (
        <span className="flex min-h-11 items-center gap-1 px-3 font-semibold text-income" role="status">
          <Check size={18} aria-hidden /> Записано
        </span>
      ) : (
        <>
          <button
            type="button"
            onClick={onPay}
            aria-label={`Оплачено: ${o.recurring.name}`}
            className="min-h-11 shrink-0 rounded-ctl bg-primary px-3 text-caption font-semibold text-white active:opacity-80"
          >
            Оплачено
          </button>
          <button
            type="button"
            onClick={onMore}
            aria-label={`Ещё: ${o.recurring.name}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-muted"
          >
            <MoreHorizontal size={20} aria-hidden />
          </button>
        </>
      )}
    </li>
  );
}

function IncomeCard({ o, done, onYes, onNotYet }: { o: Occurrence; done: boolean; onYes: () => void; onNotYet: () => void }) {
  const today = useToday();
  return (
    <li className="space-y-3 px-4 py-3">
      <div className="flex items-center gap-3">
        <IconCircle name="TrendingUp" color="#0B7A4B" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{o.recurring.name} — пришло?</p>
          <p className={`tabular text-caption ${o.dueDate < today ? 'text-warn' : 'text-muted'}`}>
            Ожидалось {formatRelativeDate(o.dueDate, today).toLowerCase()} · {formatMoney(o.recurring.amount, o.recurring.currency)}
          </p>
        </div>
      </div>
      {done ? (
        <p className="flex items-center gap-1 font-semibold text-income" role="status">
          <Check size={18} aria-hidden /> Записано
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onYes} className="min-h-11 rounded-ctl bg-income font-semibold text-white active:opacity-80">
            Да
          </button>
          <button type="button" onClick={onNotYet} className="min-h-11 rounded-ctl bg-bg font-semibold text-ink ring-1 ring-line">
            Ещё нет
          </button>
        </div>
      )}
    </li>
  );
}

/** «Платежи до поступления» и карточки «Пришло?» (SPEC 5.1 п. 5). */
export function PaymentsSection({ payments, incomes }: { payments: Occurrence[]; incomes: Occurrence[] }) {
  const { recurring, rateFor } = useData();
  const { push } = useNav();
  const today = useToday();
  const [recent, setRecent] = useState<Map<string, Occurrence>>(new Map());
  const [sheet, setSheet] = useState<Occurrence | null>(null);
  const [, rerender] = useState(0);

  const markDone = (o: Occurrence) => {
    setRecent((prev) => new Map(prev).set(o.key, o));
    setTimeout(() => {
      setRecent((prev) => {
        const next = new Map(prev);
        next.delete(o.key);
        return next;
      });
    }, 2000);
  };
  const pay = (o: Occurrence) => {
    markDone(o);
    void completeOccurrence(o.recurring, o.dueDate, { amount: o.recurring.amount, accountId: o.recurring.accountId, date: today });
  };

  // «Записано» держится 2 с, хотя наступление уже отмечено в базе.
  const merge = (list: Occurrence[], kind: 'expense' | 'income') => {
    const extra = [...recent.values()].filter((o) => o.recurring.kind === kind && !list.some((x) => x.key === o.key));
    return [...list, ...extra].sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  };
  const shownPayments = merge(payments, 'expense');
  const shownIncomes = merge(incomes.filter((o) => !snoozed(o, today)), 'income');
  const total = payments.reduce((s, o) => s + expectedKgs(o.recurring, rateFor), 0);

  if (recurring.length === 0) {
    return (
      <section className="rounded-card bg-surface p-4">
        <h2 className="text-h2 font-semibold">Платежи до поступления</h2>
        <p className="mt-1 text-caption text-muted">Добавьте аренду, связь, подписки и даты зарплаты — лимит на день станет точнее.</p>
        <button type="button" onClick={() => push({ name: 'recurring' })} className="mt-2 min-h-11 font-medium text-accent">
          Регулярные платежи
        </button>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-h2 font-semibold">Платежи до поступления</h2>
        {total > 0 && <span className="tabular text-caption font-semibold">{formatMoney(total, 'KGS')}</span>}
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface">
        {shownIncomes.map((o) => (
          <IncomeCard
            key={o.key}
            o={o}
            done={recent.has(o.key)}
            onYes={() => setSheet(o)}
            onNotYet={() => {
              try {
                localStorage.setItem(SNOOZE_PREFIX + o.key, today);
              } catch {
                /* приватный режим — карточка просто останется */
              }
              rerender((n) => n + 1);
            }}
          />
        ))}
        {shownPayments.map((o) => (
          <PaymentRow key={o.key} o={o} done={recent.has(o.key)} onPay={() => pay(o)} onMore={() => setSheet(o)} />
        ))}
        {shownPayments.length === 0 && shownIncomes.length === 0 && (
          <li className="px-4 py-4 text-caption text-muted">Всё оплачено до следующего поступления.</li>
        )}
      </ul>
      {sheet && <OccurrenceSheet occurrence={sheet} onDone={() => markDone(sheet)} onClose={() => setSheet(null)} />}
    </section>
  );
}
