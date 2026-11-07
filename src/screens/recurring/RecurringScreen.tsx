import { useState } from 'react';
import { useToday } from '../../app/nav';
import { deleteRecurring, restoreRecurring, saveRecurring } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { formatShortDate } from '../../domain/date';
import { formatMoney } from '../../domain/money';
import { describeSchedule, nextDueDate } from '../../domain/recurring';
import type { Recurring } from '../../domain/types';
import { Plus } from '../../ui/glyphs';
import { ListGroup, Row } from '../../ui/controls';
import { formatAmount } from '../../domain/money';
import { IconCircle } from '../../ui/icons';
import { SubScreen } from '../../ui/SubScreen';
import { useToast } from '../../ui/Toast';
import { RecurringEditor, type RecurringDraft } from './RecurringEditor';
import { LoanEditor } from './LoanEditor';
import { loanSummary } from '../../domain/loans';

/** Список и редактор регулярных платежей и источников дохода (SPEC 5.3). */
export function RecurringScreen({ subscriptionsOnly = false, back }: { subscriptionsOnly?: boolean; back?: string }) {
  const { recurring, accounts, categories, categoryById, accountById, occurrenceLog } = useData();
  const today = useToday();
  const [editing, setEditing] = useState<RecurringDraft | null>(null);
  // Кредит или рассрочка (этап 29): своё окно с календарём платежей.
  const [loanEditing, setLoanEditing] = useState<Recurring | 'new' | null>(null);
  const logsOf = (id: string) => occurrenceLog.filter((l) => l.recurringId === id);
  const toast = useToast();

  // Активные — по ближайшему наступлению, отключённые — в конце по имени.
  const nextOf = (r: Recurring) => (r.active ? (nextDueDate(r, today) ?? '9999') : 'zzz');
  const sorted = [...recurring]
    .filter((r) => !subscriptionsOnly || r.isSubscription)
    .sort((a, b) => Number(b.active) - Number(a.active) || nextOf(a).localeCompare(nextOf(b)) || a.name.localeCompare(b.name, 'ru'));

  const loanRow = (r: Recurring) => {
    const c = categoryById.get(r.categoryId);
    const s = loanSummary(r.loan!, logsOf(r.id));
    return (
      <Row key={r.id} onClick={() => setLoanEditing(r)} className={`min-h-[68px] py-2 ${r.active ? '' : 'opacity-50'}`}>
        <IconCircle name={c?.icon ?? 'Bank'} color={c?.color ?? 'slate'} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{r.name}</p>
          <p className="text-[12px] text-muted">
            {r.loan!.kind === 'credit' ? 'Кредит' : 'Рассрочка'}
            {r.loan!.lender ? ` · ${r.loan!.lender}` : ''} · {s.paidCount} из {s.count}
            {s.next ? ` · ближайший ${formatShortDate(s.next.date)}` : ' · выплачен'}
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-[3px] bg-sunk" aria-hidden>
            <div className="h-full rounded-[3px] bg-income" style={{ width: `${s.paidPct / 100}%` }} />
          </div>
        </div>
        <span className="tabular shrink-0 text-right">
          <span className="block font-semibold">{formatMoney(s.next?.amount ?? s.monthly, r.currency)}</span>
          <span className="block text-[12px] text-muted">осталось {formatAmount(s.left)}</span>
        </span>
      </Row>
    );
  };

  const row = (r: Recurring) => {
    if (r.loan) return loanRow(r);
    const c = categoryById.get(r.categoryId);
    const next = r.active ? nextDueDate(r, today) : undefined;
    return (
      <Row key={r.id} onClick={() => setEditing(r)} className={`min-h-[60px] py-1.5 ${r.active ? '' : 'opacity-50'}`}>
        <IconCircle name={c?.icon ?? 'Repeat'} color={c?.color ?? 'slate'} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{r.name}</p>
          {/* Подпись переносится, а не режется: дата ближайшего платежа — самое полезное в строке. */}
          <p className="text-[12px] text-muted">
            {r.active ? describeSchedule(r.schedule) : 'отключён'}
            {next ? ` · ближайший ${formatShortDate(next)}` : r.active && r.endDate ? ' · закончился' : ''} · {accountById.get(r.accountId)?.name}
            {r.isMandatory ? ' · обязательный' : ''}
            {r.endDate ? ` · до ${formatShortDate(r.endDate)}` : ''}
          </p>
        </div>
        <span className={`tabular shrink-0 font-semibold ${r.kind === 'income' ? 'text-income' : ''}`}>
          {r.kind === 'income' ? '+' : ''}
          {formatMoney(r.amount, r.currency)}
        </span>
      </Row>
    );
  };

  const incomes = sorted.filter((r) => r.kind === 'income');
  const loans = sorted.filter((r) => r.kind === 'expense' && r.loan);
  const payments = sorted.filter((r) => r.kind === 'expense' && !r.isSubscription && !r.loan);
  const subs = sorted.filter((r) => r.kind === 'expense' && r.isSubscription);
  const subsPerMonth = subs.filter((r) => r.active && r.currency === 'KGS').reduce((s, r) => s + r.amount, 0);
  // Закончившиеся (кредит выплачен, подписка до даты) в «в месяц» не входят.
  const activeExpenses = sorted.filter((r) => r.kind === 'expense' && r.active && r.currency === 'KGS' && nextDueDate(r, today)).reduce((s, r) => s + r.amount, 0);
  const dashed = 'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-line font-semibold text-accent';

  return (
    <SubScreen
      title={subscriptionsOnly ? 'Подписки' : 'Регулярные'}
      subtitle={subscriptionsOnly ? `${formatAmount(subsPerMonth)} сом в месяц` : `Платежей на ${formatAmount(activeExpenses)} сом в месяц`}
      back={back ?? (subscriptionsOnly ? 'Отчёты' : 'Деньги')}
    >
      {!subscriptionsOnly && (
        <ListGroup title="Доходы">
          {incomes.length ? incomes.map(row) : <p className="px-4 py-3 text-caption text-muted">Пока нет. От даты дохода считается лимит на день.</p>}
        </ListGroup>
      )}
      {!subscriptionsOnly && (
        <ListGroup title="Платежи">{payments.length ? payments.map(row) : <p className="px-4 py-3 text-caption text-muted">Пока нет.</p>}</ListGroup>
      )}
      {!subscriptionsOnly && loans.length > 0 && <ListGroup title="Кредиты и рассрочки">{loans.map(row)}</ListGroup>}
      {(subscriptionsOnly || subs.length > 0) && (
        <ListGroup title={`Подписки · ${formatAmount(subsPerMonth)} в месяц`}>
          {subs.length ? subs.map(row) : <p className="px-4 py-3 text-caption text-muted">Пока нет.</p>}
        </ListGroup>
      )}
      {subscriptionsOnly ? (
        <button type="button" className={dashed} onClick={() => setEditing({ kind: 'expense', isSubscription: true, isMandatory: false })}>
          <Plus size={18} aria-hidden /> Добавить подписку
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" className={dashed} onClick={() => setEditing({ kind: 'expense', isSubscription: false, isMandatory: true })}>
            <Plus size={18} aria-hidden /> Добавить платёж
          </button>
          <button type="button" className={dashed} onClick={() => setEditing({ kind: 'income' })}>
            <Plus size={18} aria-hidden /> Добавить источник дохода
          </button>
          <button type="button" className={`${dashed} col-span-2`} onClick={() => setLoanEditing('new')}>
            <Plus size={18} aria-hidden /> Кредит или рассрочка
          </button>
        </div>
      )}
      {loanEditing && (
        <LoanEditor
          initial={loanEditing === 'new' ? undefined : loanEditing}
          accounts={accounts}
          categories={categories}
          logs={loanEditing === 'new' ? [] : logsOf(loanEditing.id)}
          today={today}
          onSave={saveRecurring}
          onDelete={() => {
            if (loanEditing === 'new') return;
            const { id, name } = loanEditing;
            void deleteRecurring(id);
            toast({ message: `Удалено: ${name}`, actionLabel: 'Отменить', onAction: () => void restoreRecurring(id) });
          }}
          onClose={() => setLoanEditing(null)}
        />
      )}
      {editing && (
        <RecurringEditor
          initial={editing}
          accounts={accounts}
          categories={categories}
          today={today}
          onSave={saveRecurring}
          onLoan={() => {
            setEditing(null);
            setLoanEditing('new');
          }}
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
