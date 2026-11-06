import { useState } from 'react';
import { useToday } from '../../app/nav';
import { deleteRecurring, restoreRecurring, saveRecurring } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { formatShortDate } from '../../domain/date';
import { formatMoney } from '../../domain/money';
import { describeSchedule, nextDueDate } from '../../domain/recurring';
import type { Recurring } from '../../domain/types';
import { Button, ListGroup, Row } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { SubScreen } from '../../ui/SubScreen';
import { useToast } from '../../ui/Toast';
import { RecurringEditor, type RecurringDraft } from './RecurringEditor';

/** Список и редактор регулярных платежей и источников дохода (SPEC 5.3). */
export function RecurringScreen({ subscriptionsOnly = false, back }: { subscriptionsOnly?: boolean; back?: string }) {
  const { recurring, accounts, categories, categoryById, accountById } = useData();
  const today = useToday();
  const [editing, setEditing] = useState<RecurringDraft | null>(null);
  const toast = useToast();

  const sorted = [...recurring]
    .filter((r) => !subscriptionsOnly || r.isSubscription)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'ru'));

  const row = (r: Recurring) => {
    const c = categoryById.get(r.categoryId);
    const next = r.active ? nextDueDate(r, today) : undefined;
    return (
      <Row key={r.id} onClick={() => setEditing(r)} className={r.active ? '' : 'opacity-50'}>
        <IconCircle name={c?.icon ?? 'Repeat'} color={c?.color ?? '#5B6170'} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {r.name}
            {r.isMandatory && <span className="ml-1.5 text-caption font-normal text-muted">обязательный</span>}
          </p>
          <p className="truncate text-caption text-muted">
            {r.active ? describeSchedule(r.schedule) : 'отключён'}
            {next ? ` · ближайший ${formatShortDate(next)}` : ''} · {accountById.get(r.accountId)?.name}
          </p>
        </div>
        <span className={`tabular shrink-0 ${r.kind === 'income' ? 'text-income' : ''}`}>
          {r.kind === 'income' ? '+' : ''}
          {formatMoney(r.amount, r.currency)}
        </span>
      </Row>
    );
  };

  const incomes = sorted.filter((r) => r.kind === 'income');
  const payments = sorted.filter((r) => r.kind === 'expense');

  return (
    <SubScreen title={subscriptionsOnly ? 'Подписки' : 'Регулярные'} back={back ?? (subscriptionsOnly ? 'Отчёты' : 'Деньги')}>
      {!subscriptionsOnly && (
        <div className="space-y-2">
          <ListGroup title="Источники дохода">
            {incomes.length ? incomes.map(row) : <p className="px-4 py-3 text-caption text-muted">Пока нет. От даты дохода считается лимит на день.</p>}
          </ListGroup>
          <Button variant="secondary" className="w-full" onClick={() => setEditing({ kind: 'income' })}>
            Добавить источник дохода
          </Button>
        </div>
      )}
      <div className="space-y-2">
        <ListGroup title={subscriptionsOnly ? undefined : 'Платежи'}>
          {payments.length ? payments.map(row) : <p className="px-4 py-3 text-caption text-muted">Пока нет.</p>}
        </ListGroup>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => setEditing({ kind: 'expense', isSubscription: subscriptionsOnly, isMandatory: !subscriptionsOnly })}
        >
          {subscriptionsOnly ? 'Добавить подписку' : 'Добавить платёж'}
        </Button>
      </div>
      {editing && (
        <RecurringEditor
          initial={editing}
          accounts={accounts}
          categories={categories}
          today={today}
          onSave={saveRecurring}
          onDelete={() => {
            const { id, name } = editing;
            if (!id) return;
            void deleteRecurring(id);
            toast({ message: `Удалено: ${name ?? ''}`, actionLabel: 'Отменить', onAction: () => void restoreRecurring(id) });
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </SubScreen>
  );
}
