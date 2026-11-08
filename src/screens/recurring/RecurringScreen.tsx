import { useState } from 'react';
import { useToday } from '../../app/nav';
import { deleteRecurring, restoreRecurring, saveLoan, saveRecurring } from '../../data/actions';
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
import { loanSummary, loansOverview } from '../../domain/loans';

/**
 * Список и редактор регулярных платежей и источников дохода (SPEC 5.3). `only` — тот же экран для одного раздела:
 * «Подписки» из отчётов и «Кредиты» из «Денег» (по просьбе пользователя: список кредитов — правка, отметки, удаление).
 */
export function RecurringScreen({ only, back }: { only?: 'subscriptions' | 'loans'; back?: string }) {
  const subscriptionsOnly = only === 'subscriptions';
  const loansOnly = only === 'loans';
  const all = !only;
  const { recurring, accounts, categories, categoryById, accountById, occurrenceLog, rateFor } = useData();
  const today = useToday();
  const [editing, setEditing] = useState<RecurringDraft | null>(null);
  // Кредит или рассрочка (этап 29): своё окно с календарём платежей.
  const [loanEditing, setLoanEditing] = useState<Recurring | 'new' | null>(null);
  const logsOf = (id: string) => occurrenceLog.filter((l) => l.recurringId === id);
  const toast = useToast();

  // Активные — по ближайшему наступлению, отключённые — в конце по имени.
  const nextOf = (r: Recurring) => (r.active ? (nextDueDate(r, today) ?? '9999') : 'zzz');
  const sorted = [...recurring]
    .filter((r) => (subscriptionsOnly ? r.isSubscription : loansOnly ? !!r.loan : true))
    .sort((a, b) => Number(b.active) - Number(a.active) || nextOf(a).localeCompare(nextOf(b)) || a.name.localeCompare(b.name, 'ru'));

  const loanRow = (r: Recurring) => {
    const c = categoryById.get(r.categoryId);
    const s = loanSummary(r.loan!, logsOf(r.id));
    return (
      <Row key={r.id} onClick={() => setLoanEditing(r)} className={`min-h-[68px] py-2 ${r.active ? '' : 'opacity-50'}`}>
        <IconCircle name={c?.icon ?? 'Bank'} color={c?.color ?? 'slate'} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{r.name}</p>
          <p className="text-meta text-muted">
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
          <span className="block text-meta text-muted">осталось {formatAmount(s.left)}</span>
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
          <p className="text-meta text-muted">
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
  // «+» справа от заголовка раздела (по просьбе пользователя): сразу видно, куда добавится. Зона 44×44, а по высоте
  // заголовок растёт меньше: −8 px сверху и снизу уходят в отступы между разделами, на карточку не заходят.
  const add = (label: string, onClick: () => void) => (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="-my-2 -mr-0.5 flex size-11 shrink-0 items-center justify-center rounded-ctl text-accent active:bg-line"
    >
      <Plus size={22} aria-hidden />
    </button>
  );
  const addSubscription = add('Добавить подписку', () => setEditing({ kind: 'expense', isSubscription: true, isMandatory: false }));
  const loansLeft = loansOnly ? loansOverview(recurring, occurrenceLog, rateFor) : undefined;
  const title = subscriptionsOnly ? 'Подписки' : loansOnly ? 'Кредиты' : 'Регулярные';
  const subtitle = subscriptionsOnly
    ? `${formatAmount(subsPerMonth)} сом в месяц`
    : loansLeft
      ? loansLeft.count
        ? `Осталось выплатить ${loansLeft.approx ? '≈ ' : ''}${formatAmount(loansLeft.left)} сом`
        : loansLeft.any
          ? 'Всё выплачено'
          : 'Кредитов и рассрочек нет'
      : `Платежей на ${formatAmount(activeExpenses)} сом в месяц`;

  return (
    <SubScreen title={title} subtitle={subtitle} back={back ?? (subscriptionsOnly ? 'Отчёты' : 'Деньги')}>
      {all && (
        <ListGroup title="Доходы" action={add('Добавить источник дохода', () => setEditing({ kind: 'income' }))}>
          {incomes.length ? incomes.map(row) : <p className="px-4 py-3.5 text-sub text-muted">Пока нет. От даты дохода считается лимит на день.</p>}
        </ListGroup>
      )}
      {all && (
        <ListGroup title="Платежи" action={add('Добавить платёж', () => setEditing({ kind: 'expense', isSubscription: false, isMandatory: true }))}>
          {payments.length ? payments.map(row) : <p className="px-4 py-3.5 text-sub text-muted">Пока нет.</p>}
        </ListGroup>
      )}
      {/* Раздел виден и пустым: в его заголовке — «+» для нового кредита. */}
      {(all || loansOnly) && (
        <ListGroup title="Кредиты и рассрочки" action={add('Добавить кредит или рассрочку', () => setLoanEditing('new'))}>
          {loans.length ? loans.map(row) : <p className="px-4 py-3.5 text-sub text-muted">Пока нет.</p>}
        </ListGroup>
      )}
      {(subscriptionsOnly || (all && subs.length > 0)) && (
        <ListGroup title={`Подписки · ${formatAmount(subsPerMonth)} в месяц`} action={addSubscription}>
          {subs.length ? subs.map(row) : <p className="px-4 py-3.5 text-sub text-muted">Пока нет.</p>}
        </ListGroup>
      )}
      {loanEditing && (
        <LoanEditor
          initial={loanEditing === 'new' ? undefined : loanEditing}
          accounts={accounts}
          categories={categories}
          logs={loanEditing === 'new' ? [] : logsOf(loanEditing.id)}
          today={today}
          onSave={saveLoan}
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
