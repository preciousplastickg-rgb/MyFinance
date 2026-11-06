import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useNav, useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { BASE_CURRENCY } from '../../domain/currency';
import { formatRelativeDate, formatShortDate } from '../../domain/date';
import { formatAmount, formatMoney, plural } from '../../domain/money';
import { expectedKgs, type DailyLimit } from '../../domain/recurring';
import type { Transaction } from '../../domain/types';
import { Row } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { TransactionEditor } from '../entry/TransactionEditor';

/** Из чего сложился лимит на день — с переходами к счетам, платежам и тратам (этап 18). */
export function LimitSheet({ limit, onClose }: { limit: DailyLimit; onClose: () => void }) {
  const { accounts, balances, transactions, rateFor, categoryById } = useData();
  const { push, showAccountHistory } = useNav();
  const today = useToday();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const daily = accounts.filter((a) => a.includeInDaily && !a.archived);
  const dailyIds = new Set(daily.map((a) => a.id));
  const spent = transactions.filter((t) => t.type === 'expense' && t.date === today && !t.recurringId && dailyIds.has(t.accountId));
  const days = `${limit.days} ${plural(limit.days, ['день', 'дня', 'дней'])}`;

  const go = (fn: () => void) => {
    onClose();
    fn();
  };

  return (
    <Sheet title="Из чего лимит" onClose={onClose} full>
      <div className="space-y-5">
        <p className="tabular rounded-ctl bg-sunk px-3.5 py-3 text-[14px]">
          ({formatAmount(limit.startOfDay)} на счетах − {formatAmount(limit.mandatory)} обязательных) ÷ {days} ={' '}
          <b>{formatMoney(limit.limit, BASE_CURRENCY)}</b> в день
        </p>

        <Section title="На счетах на начало дня" total={limit.startOfDay}>
          {daily.map((a) => (
            <Row key={a.id} onClick={() => go(() => showAccountHistory(a.id))}>
              <IconCircle name={a.icon} color={a.color} size={32} />
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              <span className="tabular shrink-0">{formatMoney(balances.get(a.id) ?? 0, a.currency)}</span>
              <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
            </Row>
          ))}
        </Section>

        <Section title="Обязательные до поступления" total={-limit.mandatory} empty="Обязательных платежей до поступления нет">
          {limit.mandatoryItems.map((o) => (
            <Row key={o.key} onClick={() => go(() => push({ name: 'recurring', back: 'Сегодня' }))}>
              <IconCircle name={categoryById.get(o.recurring.categoryId)?.icon ?? 'Repeat'} color={categoryById.get(o.recurring.categoryId)?.color ?? 'slate'} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.recurring.name}</span>
                <span className="block text-caption text-muted">{formatRelativeDate(o.dueDate, today)}</span>
              </span>
              <span className="tabular shrink-0">−{formatAmount(expectedKgs(o.recurring, rateFor))}</span>
              <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
            </Row>
          ))}
        </Section>

        <Section title="Потрачено сегодня" total={-limit.spentToday} empty="Сегодня трат ещё нет">
          {spent.map((t) => (
            <Row key={t.id} onClick={() => setEditing(t)}>
              <IconCircle name={categoryById.get(t.categoryId ?? '')?.icon ?? 'Ellipsis'} color={categoryById.get(t.categoryId ?? '')?.color ?? 'slate'} size={32} />
              <span className="min-w-0 flex-1 truncate">{categoryById.get(t.categoryId ?? '')?.name ?? 'Без категории'}</span>
              <span className="tabular shrink-0">−{formatAmount(t.amount)}</span>
            </Row>
          ))}
        </Section>

        <Row onClick={() => go(() => push({ name: 'recurring', back: 'Сегодня' }))} className="rounded-[20px] bg-sunk">
          <IconCircle name="TrendingUp" color="green" size={32} />
          <span className="min-w-0 flex-1">
            <span className="block">Поступление</span>
            <span className="block text-caption text-muted">
              {limit.income
                ? `${limit.income.recurring.name} · ${limit.incomeToday ? 'сегодня в 17:00' : formatShortDate(limit.income.dueDate)}`
                : 'Источников дохода нет — лимит до конца месяца. Добавить'}
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
        </Row>
      </div>
      {editing && <TransactionEditor tx={editing} onClose={() => setEditing(null)} />}
    </Sheet>
  );
}

function Section({ title, total, empty, children }: { title: string; total: number; empty?: string; children: React.ReactNode[] }) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h3 className="text-caption font-semibold text-muted">{title}</h3>
        <span className="tabular text-caption font-semibold">
          {total < 0 ? '−' : ''}
          {formatMoney(Math.abs(total), BASE_CURRENCY)}
        </span>
      </div>
      {children.length ? (
        <div className="divide-y divide-line overflow-hidden rounded-[20px] bg-sunk">{children}</div>
      ) : (
        empty && <p className="rounded-[20px] bg-sunk px-4 py-3 text-caption text-muted">{empty}</p>
      )}
    </section>
  );
}
