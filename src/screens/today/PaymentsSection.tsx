import { Check, MoreHorizontal } from 'lucide-react';
import { useRef, useState, type PointerEvent } from 'react';
import { useIncomeTimePassed, useNav, useToday } from '../../app/nav';
import { completeOccurrence, deleteTransaction, unskipOccurrence } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { diffDays, formatRelativeDate } from '../../domain/date';
import { formatMoney } from '../../domain/money';
import { expectedKgs, type Occurrence } from '../../domain/recurring';
import type { Transaction } from '../../domain/types';
import { IconCircle } from '../../ui/icons';
import { SectionHeader } from '../../ui/SectionHeader';
import { useToast } from '../../ui/Toast';
import { OccurrenceSheet } from './OccurrenceSheet';
import { BASE_CURRENCY } from '../../domain/currency';

const SNOOZE_KEY = 'income-snooze';

/** «Ещё нет» прячет карточку дохода до завтра. Одна запись в localStorage, старые дни вычищаются при чтении. */
function readSnoozes(today: string): Record<string, string> {
  try {
    const all = JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? '{}') as Record<string, string>;
    const fresh = Object.fromEntries(Object.entries(all).filter(([, d]) => d === today));
    if (Object.keys(fresh).length !== Object.keys(all).length) localStorage.setItem(SNOOZE_KEY, JSON.stringify(fresh));
    return fresh;
  } catch {
    return {};
  }
}

function snooze(o: Occurrence, today: string): void {
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify({ ...readSnoozes(today), [o.key]: today }));
  } catch {
    /* приватный режим — карточка просто останется */
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
            className="min-h-11 shrink-0 rounded-ctl bg-surface px-3 text-caption font-semibold text-accent ring-1 ring-accent/40 active:bg-bg"
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
  const passed = useIncomeTimePassed();
  // До 17:00 в день поступления доход ещё впереди: зачислится сам, но можно отметить раньше.
  if (!done && o.dueDate === today && !passed) {
    return (
      <li className="flex items-center gap-3 px-4 py-2.5">
        <IconCircle name="TrendingUp" color="#0B7A4B" />
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{o.recurring.name}</p>
          <p className="tabular text-caption text-muted">
            Сегодня в 17:00 зачислится само · {formatMoney(o.recurring.amount, o.recurring.currency)}
          </p>
        </div>
        <button
          type="button"
          onClick={onYes}
          aria-label={`Уже пришло: ${o.recurring.name}`}
          className="min-h-11 shrink-0 rounded-ctl bg-surface px-3 text-caption font-semibold text-income ring-1 ring-income/40 active:bg-bg"
        >
          Уже пришло
        </button>
      </li>
    );
  }
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
export function PaymentsSection({ payments, incomes, mandatory }: { payments: Occurrence[]; incomes: Occurrence[]; mandatory: number }) {
  const { recurring, rateFor, accountById } = useData();
  const toast = useToast();
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
  // Платёж записывается одним тапом — поэтому, как у обычной траты, есть «Отменить» (SPEC 4.3, 5.2).
  const recorded = (o: Occurrence, tx: Transaction) => {
    const account = accountById.get(tx.accountId);
    const sign = tx.type === 'income' ? '+' : '−';
    toast({
      message: `${o.recurring.name} ${sign}${formatMoney(tx.amount, account?.currency ?? o.recurring.currency)}`,
      actionLabel: 'Отменить',
      onAction: () => void deleteTransaction(tx.id),
    });
  };
  const pay = (o: Occurrence) => {
    // Счёт платежа в архиве или сменил валюту — одним тапом не записываем, пусть выберут счёт в окне.
    const account = accountById.get(o.recurring.accountId);
    if (!account || account.archived || account.currency !== o.recurring.currency) return setSheet(o);
    markDone(o); // «Записано» сразу, не дожидаясь базы
    void completeOccurrence(o.recurring, o.dueDate, { amount: o.recurring.amount, accountId: o.recurring.accountId, date: today }).then((tx) =>
      recorded(o, tx),
    );
  };
  const skipped = (o: Occurrence, logId: string) =>
    toast({ message: `${o.recurring.name}: пропущено`, actionLabel: 'Отменить', onAction: () => void unskipOccurrence(logId) });

  // «Записано» держится 2 с, хотя наступление уже отмечено в базе.
  const merge = (list: Occurrence[], kind: 'expense' | 'income') => {
    const extra = [...recent.values()].filter((o) => o.recurring.kind === kind && !list.some((x) => x.key === o.key));
    return [...list, ...extra].sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  };
  const shownPayments = merge(payments, 'expense');
  const snoozes = readSnoozes(today);
  const shownIncomes = merge(incomes.filter((o) => !snoozes[o.key]), 'income');
  const total = payments.reduce((s, o) => s + expectedKgs(o.recurring, rateFor), 0);

  if (recurring.length === 0) {
    return (
      <section>
        <div className="mb-2">
          <SectionHeader title="Платежи до поступления" right="Добавить" onClick={() => push({ name: 'recurring', back: 'Сегодня' })} />
        </div>
        <p className="rounded-card bg-surface px-4 py-4 text-caption text-muted">
          Добавьте аренду, связь, подписки и даты зарплаты — лимит на день станет точнее.
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-2">
        <SectionHeader
          title="Платежи до поступления"
          right={total > 0 ? <span className="tabular font-semibold text-ink">{formatMoney(total, BASE_CURRENCY)}</span> : 'Все'}
          onClick={() => push({ name: 'recurring', back: 'Сегодня' })}
        />
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface">
        {shownIncomes.map((o) => (
          <IncomeCard
            key={o.key}
            o={o}
            done={recent.has(o.key)}
            onYes={() => setSheet(o)}
            onNotYet={() => {
              snooze(o, today);
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
      {/* Итог блока — все платежи, лимит вычитает только обязательные: чтобы две цифры рядом не спорили. */}
      {total > 0 && mandatory !== total && (
        <p className="tabular mt-2 px-1 text-caption text-muted">
          Из них обязательных {formatMoney(mandatory, BASE_CURRENCY)} — они вычтены из лимита, остальные нет.
        </p>
      )}
      {sheet && (
        <OccurrenceSheet
          occurrence={sheet}
          onDone={(tx) => {
            markDone(sheet);
            recorded(sheet, tx);
          }}
          onSkipped={(logId) => skipped(sheet, logId)}
          onClose={() => setSheet(null)}
        />
      )}
    </section>
  );
}
