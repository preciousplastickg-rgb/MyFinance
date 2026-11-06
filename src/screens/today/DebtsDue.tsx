import { ChevronRight } from 'lucide-react';
import { useNav, useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { addDays, formatRelativeDate } from '../../domain/date';
import { debtsOverview } from '../../domain/debts';
import { formatMoney } from '../../domain/money';
import { IconCircle } from '../../ui/icons';
import { Row } from '../../ui/controls';
import { SectionHeader } from '../../ui/SectionHeader';

/** «Долги» на «Сегодня»: просроченные и со сроком в ближайшие 7 дней; тап — экран долгов (этап 18). */
export function DebtsDue() {
  const { debts, transactions } = useData();
  const { push } = useNav();
  const today = useToday();
  if (!debts.length) return null;
  const o = debtsOverview(debts, transactions, today);
  const soon = addDays(today, 7);
  const due = [...o.owedToMe, ...o.iOwe]
    .filter((s) => s.debt.dueDate && s.debt.dueDate <= soon)
    .sort((a, b) => (a.debt.dueDate! < b.debt.dueDate! ? -1 : 1));
  if (!due.length) return null;
  return (
    <section className="space-y-2">
      <SectionHeader title="Долги" right="Все" onClick={() => push({ name: 'debts' })} />
      <div className="divide-y divide-line overflow-hidden rounded-card bg-surface">
        {due.map((s) => (
          <Row key={s.debt.id} onClick={() => push({ name: 'debts' })}>
            <IconCircle name="HandCoins" color={s.debt.direction === 'owedToMe' ? '#0B7A4B' : '#B45309'} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {s.debt.direction === 'owedToMe' ? `${s.debt.person} должен вернуть` : `Вернуть ${s.debt.person}`}
              </span>
              <span className={`block text-caption ${s.overdue ? 'font-semibold text-warn' : 'text-muted'}`}>
                {s.overdue ? 'Просрочено, срок был ' : 'Срок — '}
                {formatRelativeDate(s.debt.dueDate!, today).toLowerCase()}
              </span>
            </span>
            <span className="tabular shrink-0 font-medium">{formatMoney(s.remaining, s.debt.currency)}</span>
            <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
          </Row>
        ))}
      </div>
    </section>
  );
}
