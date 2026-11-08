import { useMemo, useState } from 'react';
import { newId } from '../../data/actions';
import { addDays } from '../../domain/date';
import { buildSchedule, formatPercent, loanRecurringFields, loanSummary } from '../../domain/loans';
import { currencyLabel, formatAmount, formatMoney, minorToText, parseMoneyText } from '../../domain/money';
import { formatShortDate } from '../../domain/date';
import type { Account, Category, Loan, LoanPayment, OccurrenceLog, Recurring } from '../../domain/types';
import { Button, Field, inputClass, Segmented, Switch, TextInput } from '../../ui/controls';
import { ConfirmSheet } from '../../ui/ConfirmSheet';
import { Check } from '../../ui/glyphs';
import { Sheet } from '../../ui/Sheet';

type LoanKind = Loan['kind'];
interface Row {
  date: string;
  amount: string;
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const toRows = (p: readonly LoanPayment[]): Row[] => p.map((x) => ({ date: x.date, amount: minorToText(x.amount) }));

/**
 * Кредит или рассрочка (этап 29) — сразу регулярный платёж: условия, итоги (платёж, всего, переплата и её процент, выплачено)
 * и календарь платежей, который можно править как в графике банка. Пока календарь не трогали, он пересчитывается по условиям.
 */
export function LoanEditor({
  initial,
  kind: initialKind = 'credit',
  accounts,
  categories,
  logs,
  today,
  onSave,
  onDelete,
  onClose,
}: {
  initial?: Recurring;
  kind?: LoanKind;
  accounts: readonly Account[];
  categories: readonly Category[];
  /** Отметки этого платежа — какие платежи уже оплачены. */
  logs: readonly OccurrenceLog[];
  today: string;
  onSave: (recurring: Recurring) => void | Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const loan = initial?.loan;
  const activeAccounts = accounts.filter((a) => !a.archived && a.type !== 'savings');
  const expense = categories.filter((c) => c.kind === 'expense' && !c.archived);
  const [kind, setKind] = useState<LoanKind>(loan?.kind ?? initialKind);
  const [name, setName] = useState(initial?.name ?? '');
  const [lender, setLender] = useState(loan?.lender ?? '');
  const [principal, setPrincipal] = useState(loan ? minorToText(loan.principal) : '');
  const [term, setTerm] = useState(loan ? String(loan.termMonths) : '12');
  const [rate, setRate] = useState(loan?.rate ? minorToText(loan.rate) : '');
  const [firstDate, setFirstDate] = useState(loan?.firstDate ?? addDays(today, 30));
  const [accountId, setAccountId] = useState(initial?.accountId ?? activeAccounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? expense.find((c) => c.name === 'Прочее')?.id ?? expense[0]?.id ?? '');
  const [isMandatory, setIsMandatory] = useState(initial?.isMandatory ?? true);
  const [active, setActive] = useState(initial?.active ?? true);
  // Календарь, поправленный руками; null — считается по условиям.
  const [edited, setEdited] = useState<Row[] | null>(loan ? toRows(loan.payments) : null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const account = accounts.find((a) => a.id === accountId);
  const cur = account?.currency ?? 'KGS';
  const principalMinor = parseMoneyText(principal);
  const termN = /^\d{1,3}$/.test(term.trim()) ? Number(term.trim()) : NaN;
  const rateBp = rate.trim() === '' ? 0 : parseMoneyText(rate);
  const paramsOk = principalMinor !== null && principalMinor > 0 && termN >= 1 && termN <= 360 && rateBp !== null && rateBp >= 0 && isDate(firstDate);

  const auto = useMemo(
    () => (paramsOk ? toRows(buildSchedule({ kind, principal: principalMinor!, rate: rateBp!, termMonths: termN, firstDate })) : []),
    [paramsOk, kind, principalMinor, rateBp, termN, firstDate],
  );
  const rows = edited ?? auto;
  const payments: LoanPayment[] | null = rows.every((r) => isDate(r.date) && (parseMoneyText(r.amount) ?? 0) > 0)
    ? rows.map((r) => ({ date: r.date, amount: parseMoneyText(r.amount)! }))
    : null;
  const summary = paramsOk && payments?.length ? loanSummary({ principal: principalMinor!, payments }, logs) : undefined;
  const paidDates = new Set(logs.filter((l) => l.status === 'done').map((l) => l.dueDate));
  const valid = name.trim() !== '' && paramsOk && !!account && categoryId !== '' && !!payments?.length;

  const setRow = (i: number, patch: Partial<Row>) => setEdited(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    if (!valid || !account || !payments) return;
    const sorted = [...payments].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const next: Loan = {
      kind,
      principal: principalMinor!,
      termMonths: termN,
      firstDate,
      payments: sorted,
      ...(rateBp ? { rate: rateBp } : {}),
      ...(lender.trim() ? { lender: lender.trim() } : {}),
    };
    await onSave({
      id: initial?.id ?? newId(),
      kind: 'expense',
      name: name.trim(),
      currency: account.currency,
      accountId: account.id,
      categoryId,
      isMandatory,
      isSubscription: false,
      active,
      ...loanRecurringFields(next),
      loan: next,
    });
    onClose();
  };

  const credit = kind === 'credit';
  return (
    <Sheet
      title={initial ? (credit ? 'Кредит' : 'Рассрочка') : credit ? 'Новый кредит' : 'Новая рассрочка'}
      onClose={onClose}
      full
      footer={
        <Button className="w-full" disabled={!valid} onClick={() => void save()}>
          Сохранить
        </Button>
      }
    >
      <div className="space-y-5 pt-2">
        <Segmented
          label="Вид"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'credit', label: 'Кредит' },
            { value: 'installment', label: 'Рассрочка' },
          ]}
        />
        <Field label="Название">
          {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder={credit ? 'Кредит на ремонт' : 'Рассрочка на телефон'} />}
        </Field>
        <Field label={credit ? 'Банк (необязательно)' : 'Магазин или банк (необязательно)'}>
          {(id) => <TextInput id={id} value={lender} onChange={(e) => setLender(e.target.value)} placeholder={credit ? 'MBank' : 'Sulpak'} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${credit ? 'Сумма кредита' : 'Стоимость покупки'}, ${currencyLabel(cur)}`}>
            {(id) => <TextInput id={id} inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="0" />}
          </Field>
          <Field label="Срок, месяцев">
            {(id) => <TextInput id={id} inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="12" />}
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={credit ? 'Ставка, % годовых' : 'Наценка, %'} hint={credit ? undefined : 'Обычно 0'}>
            {(id) => <TextInput id={id} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" />}
          </Field>
          <Field label="Первый платёж">{(id) => <TextInput id={id} type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} />}</Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Счёт">
            {(id) => (
              <select id={id} className={`${inputClass} appearance-none`} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="На что">
            {(id) => (
              <select id={id} className={`${inputClass} appearance-none`} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {expense.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        {summary && (
          <section className="space-y-2.5 rounded-[20px] bg-sunk px-4 py-3.5" aria-label="Итоги">
            <dl className="tabular grid grid-cols-2 gap-x-3 gap-y-2.5 text-[14px]">
              <div>
                <dt className="text-[12px] text-muted">Платёж в месяц</dt>
                <dd className="font-semibold">{formatMoney(summary.monthly, cur)}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Всего выплатить</dt>
                <dd className="font-semibold">{formatMoney(summary.total, cur)}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Переплата</dt>
                <dd className={`font-semibold ${summary.overpay > 0 ? 'text-warn' : ''}`}>
                  {formatAmount(summary.overpay)} · {formatPercent(summary.overpayPct)}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">{credit ? 'Ставка' : 'Наценка'}</dt>
                <dd className="font-semibold">{credit ? `${formatPercent(rateBp ?? 0)} годовых` : formatPercent(rateBp ?? 0)}</dd>
              </div>
            </dl>
            <div>
              <div className="flex justify-between text-[12px] text-muted">
                <span>
                  Выплачено {summary.paidCount} из {summary.count} · {formatPercent(summary.paidPct)}
                </span>
                <span className="tabular">осталось {formatAmount(summary.left)}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-[4px] bg-line" role="progressbar" aria-label="Выплачено" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(summary.paidPct / 100)}>
                <div className="h-full rounded-[4px] bg-income" style={{ width: `${summary.paidPct / 100}%` }} />
              </div>
              {summary.next && (
                <p className="tabular mt-1.5 text-[12px] text-muted">
                  Ближайший платёж {formatShortDate(summary.next.date)} — {formatMoney(summary.next.amount, cur)}
                </p>
              )}
            </div>
          </section>
        )}

        <section className="space-y-2" aria-label="Календарь платежей">
          <div className="flex min-h-11 items-center justify-between px-1">
            <h3 className="text-caption font-semibold text-muted">Календарь платежей</h3>
            {edited && paramsOk && (
              <button type="button" onClick={() => setEdited(null)} className="min-h-11 px-1 text-caption font-semibold text-accent">
                Пересчитать по условиям
              </button>
            )}
          </div>
          {rows.length === 0 ? (
            <p className="rounded-[20px] bg-sunk px-4 py-3 text-caption text-muted">Укажите сумму, срок и дату первого платежа — календарь посчитается сам.</p>
          ) : (
            <ol className="divide-y divide-line overflow-hidden rounded-[20px] bg-sunk">
              {rows.map((r, i) => {
                const paid = paidDates.has(r.date);
                return (
                  <li key={i} className="flex min-h-13 items-center gap-2 px-3 py-1.5">
                    <span className="tabular w-6 shrink-0 text-center text-caption text-muted">{i + 1}</span>
                    <input
                      type="date"
                      aria-label={`Платёж ${i + 1}: дата`}
                      value={r.date}
                      onChange={(e) => setRow(i, { date: e.target.value })}
                      className="min-h-11 min-w-0 flex-1 rounded-ctl bg-surface px-2.5 text-[16px] outline-none focus:ring-2 focus:ring-accent"
                    />
                    <input
                      inputMode="decimal"
                      aria-label={`Платёж ${i + 1}: сумма`}
                      value={r.amount}
                      onChange={(e) => setRow(i, { amount: e.target.value })}
                      className="tabular min-h-11 w-[108px] shrink-0 rounded-ctl bg-surface px-2.5 text-right text-[16px] outline-none focus:ring-2 focus:ring-accent"
                    />
                    <span className="flex w-6 shrink-0 justify-center" aria-label={paid ? 'оплачен' : undefined}>
                      {paid && <Check size={16} className="text-income" aria-hidden />}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          {!payments && rows.length > 0 && <p className="px-1 text-caption text-warn">В календаре пустая дата или сумма</p>}
        </section>

        <div className="divide-y divide-line rounded-[20px] bg-sunk px-3.5">
          <div className="flex min-h-14 items-center justify-between gap-3">
            <div>
              <p className="font-medium">Обязательный</p>
              <p className="text-[12px] text-muted">Учитывается в «Платежах до зарплаты»</p>
            </div>
            <Switch checked={isMandatory} onChange={setIsMandatory} label="Обязательный" />
          </div>
          {initial && (
            <div className="flex min-h-14 items-center justify-between gap-3">
              <p className="font-medium">Активен</p>
              <Switch checked={active} onChange={setActive} label="Активен" />
            </div>
          )}
        </div>
        {initial && onDelete && (
          <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>
            Удалить
          </Button>
        )}
      </div>
      {confirmDelete && onDelete && (
        <ConfirmSheet
          title={`Удалить «${initial?.name ?? ''}»?`}
          text="Он пропадёт из списка и «Сегодня». Прошлые платежи останутся в истории."
          confirmLabel="Удалить"
          onConfirm={() => {
            onDelete();
            onClose();
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </Sheet>
  );
}
