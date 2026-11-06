import { useState } from 'react';
import { useToday } from '../../app/nav';
import { deleteTransaction, restoreTransaction } from '../../data/actions';
import { addDebtMove, deleteDebt, restoreDebt, setDebtClosed } from '../../data/debts';
import { useData } from '../../data/DataProvider';
import { formatRelativeDate, formatShortDate } from '../../domain/date';
import { debtMoveTitle, debtState, type DebtMoveKind } from '../../domain/debts';
import { formatAmount, formatMoney, minorToText, parseMoneyText } from '../../domain/money';
import type { Debt, Transaction } from '../../domain/types';
import { ConfirmSheet } from '../../ui/ConfirmSheet';
import { Button, Field, inputClass, TextInput } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { DebtEditor } from './DebtEditor';

/** Карточка долга: остаток, история, «Вернули» / «Дал ещё», правка, закрыть, удалить (этап 17). */
export function DebtSheet({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const { transactions, accountById } = useData();
  const today = useToday();
  const toast = useToast();
  const s = debtState(debt, transactions, today);
  const [move, setMove] = useState<DebtMoveKind | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<'close' | 'delete' | null>(null);
  const [moveMenu, setMoveMenu] = useState<Transaction | null>(null);
  const owed = debt.direction === 'owedToMe';

  if (editing) return <DebtEditor debt={debt} onClose={() => setEditing(false)} />;

  return (
    <Sheet title={debt.person} onClose={onClose} full>
      <div className="space-y-5">
        <div className="rounded-card bg-bg p-4">
          <p className="text-caption text-muted">{s.closed ? 'Закрыт' : owed ? 'Должен вам' : 'Вы должны'}</p>
          <p className={`tabular text-h1 font-bold ${s.overdue ? 'text-warn' : ''}`}>{formatMoney(s.remaining, debt.currency)}</p>
          <p className="tabular text-caption text-muted">
            Всего {formatAmount(s.total)} · вернули {formatAmount(s.repaid)}
            {debt.dueDate ? ` · ${s.overdue ? 'просрочен с' : 'до'} ${formatShortDate(debt.dueDate)}` : ''}
          </p>
          {debt.note && <p className="mt-1 text-caption">{debt.note}</p>}
        </div>

        {!s.closed && (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setMove('repay')}>{owed ? 'Вернули' : 'Вернул'}</Button>
            <Button variant="secondary" onClick={() => setMove('grow')}>
              {owed ? 'Дал ещё' : 'Взял ещё'}
            </Button>
          </div>
        )}

        <section className="space-y-2">
          <h3 className="text-caption font-semibold text-muted">История</h3>
          <ul className="divide-y divide-line overflow-hidden rounded-card bg-bg">
            {s.moves.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setMoveMenu(t)} className="flex min-h-13 w-full items-center gap-3 px-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{debtMoveTitle(debt.direction, t.flow ?? 'out')}</span>
                    <span className="block text-caption text-muted">
                      {formatRelativeDate(t.date, today)} · {accountById.get(t.accountId)?.name ?? 'счёт удалён'}
                    </span>
                  </span>
                  <span className="tabular shrink-0">
                    {t.flow === 'in' ? '+' : '−'}
                    {formatAmount(t.amount)}
                  </span>
                </button>
              </li>
            ))}
            {debt.opening > 0 && (
              <li className="flex min-h-13 items-center gap-3 px-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{owed ? 'Был должен' : 'Был должен я'}</span>
                  <span className="block text-caption text-muted">{formatShortDate(debt.date)} · без счёта</span>
                </span>
                <span className="tabular shrink-0">{formatAmount(debt.opening)}</span>
              </li>
            )}
          </ul>
        </section>

        <div className="space-y-2">
          <Button variant="secondary" className="w-full" onClick={() => setEditing(true)}>
            Изменить
          </Button>
          {s.closed ? (
            debt.closedAt && (
              <Button variant="secondary" className="w-full" onClick={() => void setDebtClosed(debt.id, false)}>
                Открыть снова
              </Button>
            )
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setConfirm('close')}>
              Закрыть без денег
            </Button>
          )}
          <Button variant="danger" className="w-full" onClick={() => setConfirm('delete')}>
            Удалить долг
          </Button>
        </div>
      </div>

      {move && <DebtMoveSheet debt={debt} kind={move} remaining={s.remaining} onClose={() => setMove(null)} />}
      {moveMenu && (
        <ConfirmSheet
          title={`${debtMoveTitle(debt.direction, moveMenu.flow ?? 'out')}: ${formatMoney(moveMenu.amount, debt.currency)}`}
          text="Удалить эту операцию? Баланс счёта и остаток долга пересчитаются."
          confirmLabel="Удалить операцию"
          onConfirm={() =>
            void deleteTransaction(moveMenu.id).then((d) => {
              if (d) toast({ message: 'Операция удалена', actionLabel: 'Отменить', onAction: () => void restoreTransaction(d) });
            })
          }
          onClose={() => setMoveMenu(null)}
        />
      )}
      {confirm === 'close' && (
        <ConfirmSheet
          title="Закрыть без денег?"
          text={`Остаток ${formatMoney(s.remaining, debt.currency)} спишется: долг уйдёт в закрытые, счета не изменятся.`}
          confirmLabel="Закрыть"
          onConfirm={() => void setDebtClosed(debt.id, true)}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'delete' && (
        <ConfirmSheet
          title={`Удалить долг «${debt.person}»?`}
          text="Операции по нему тоже удалятся, балансы счетов вернутся как были."
          confirmLabel="Удалить"
          onConfirm={() => {
            onClose();
            void deleteDebt(debt.id).then((d) => {
              if (d) toast({ message: `Долг удалён: ${debt.person}`, actionLabel: 'Отменить', onAction: () => void restoreDebt(d) });
            });
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </Sheet>
  );
}

/** Сумма, счёт в валюте долга и дата для «Вернули» / «Дал ещё». */
function DebtMoveSheet({ debt, kind, remaining, onClose }: { debt: Debt; kind: DebtMoveKind; remaining: number; onClose: () => void }) {
  const { accounts } = useData();
  const today = useToday();
  const toast = useToast();
  const same = accounts.filter((a) => !a.archived && a.currency === debt.currency);
  const [amount, setAmount] = useState(kind === 'repay' && remaining > 0 ? minorToText(remaining) : '');
  const [accountId, setAccountId] = useState(same[0]?.id ?? '');
  const [date, setDate] = useState(today);
  const value = parseMoneyText(amount);
  const valid = value !== null && value > 0 && !!accountId;
  const owed = debt.direction === 'owedToMe';
  const title = kind === 'repay' ? (owed ? 'Вернули' : 'Вернул') : owed ? 'Дал ещё' : 'Взял ещё';

  return (
    <Sheet title={`${title}: ${debt.person}`} onClose={onClose}>
      {same.length === 0 ? (
        <p className="text-muted">Нет счёта в валюте долга. Добавьте его в настройках или закройте долг без денег.</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            void addDebtMove(debt, kind, { accountId, amount: value!, date }).then(() => toast({ message: `${title}: ${formatMoney(value!, debt.currency)}` }));
            onClose();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Сумма">
              {(id) => <TextInput id={id} autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
            </Field>
            <Field label={(kind === 'repay') === owed ? 'На счёт' : 'Со счёта'}>
              {(id) => (
                <select id={id} className={`${inputClass} appearance-none`} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {same.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <Field label="Дата">{(id) => <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Button type="submit" className="w-full" disabled={!valid}>
            Сохранить
          </Button>
        </form>
      )}
    </Sheet>
  );
}
