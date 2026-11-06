import { Check } from 'lucide-react';
import { useState } from 'react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { debtDirectionFor, debtsOverview, type DebtMoveKind } from '../../domain/debts';
import { formatMoney, parseMoneyText } from '../../domain/money';
import type { Currency, Debt, Id, Minor } from '../../domain/types';
import { Button, Field, Segmented, TextInput } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';

export interface DebtLink {
  kind: DebtMoveKind;
  direction: Debt['direction'];
  /** Существующий долг или новый человек. */
  debtId?: Id;
  person?: string;
  dueDate?: string;
  /** Возврат по долгу, которого ещё нет в приложении: сколько всего было в долг (≥ суммы записи). */
  opening?: Minor;
}

const NEW = '__new';

const personLabel = {
  expense: { grow: 'Кому дали', repay: 'Кому вернули' },
  income: { grow: 'У кого взяли', repay: 'Кто вернул' },
} as const;

/**
 * Запись с категорией «Долг» (этап 19): кто и что это — дал / взял в долг или возврат.
 * Возврат — по открытому долгу в валюте счёта или по долгу, которого в приложении ещё нет:
 * тогда он заводится здесь же («Всего долг», по умолчанию — сумма записи, и долг сразу закрыт).
 */
export function DebtLinkSheet({
  type,
  currency,
  amount,
  amountLabel,
  onDone,
  onClose,
}: {
  type: 'expense' | 'income';
  currency: Currency;
  amount: Minor;
  amountLabel: string;
  onDone: (link: DebtLink) => void;
  onClose: () => void;
}) {
  const { debts, transactions } = useData();
  const today = useToday();
  const [kind, setKind] = useState<DebtMoveKind>('grow');
  const direction = debtDirectionFor(type, kind);
  const o = debtsOverview(debts, transactions, today);
  const all = direction === 'owedToMe' ? o.owedToMe : o.iOwe;
  const open = all.filter((s) => s.debt.currency === currency);
  const otherCurrency = all.length - open.length;
  // Кто: undefined — ещё не выбирали (возврат — первый открытый долг, иначе новый человек), NEW — новый человек.
  const [pick, setPick] = useState<string | undefined>(undefined);
  const [person, setPerson] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [total, setTotal] = useState('');
  const chosen = pick === undefined ? (kind === 'repay' ? open[0]?.debt.id : undefined) : pick === NEW ? undefined : pick;
  const opening = total.trim() === '' ? amount : parseMoneyText(total);
  const totalOk = opening !== null && opening >= amount;
  const valid = chosen ? open.some((s) => s.debt.id === chosen) : person.trim() !== '' && (kind === 'grow' || totalOk);

  const labels =
    type === 'expense'
      ? { grow: 'Дал в долг', repay: 'Вернул долг' }
      : { grow: 'Взял в долг', repay: 'Мне вернули' };

  return (
    <Sheet title={`Долг: ${amountLabel}`} onClose={onClose}>
      <div className="space-y-4">
        <Segmented
          label="Что это"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setPick(undefined);
          }}
          options={[
            { value: 'grow', label: labels.grow },
            { value: 'repay', label: labels.repay },
          ]}
        />
        <div role="radiogroup" aria-label="Кто" className="divide-y divide-line overflow-hidden rounded-card bg-bg">
          {open.map((s) => (
            <button
              key={s.debt.id}
              type="button"
              role="radio"
              aria-checked={chosen === s.debt.id}
              onClick={() => setPick(s.debt.id)}
              className="flex min-h-13 w-full items-center gap-3 px-4 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.debt.person}</span>
                <span className="block text-caption text-muted">
                  {direction === 'owedToMe' ? 'должен вам' : 'вы должны'} {formatMoney(s.remaining, s.debt.currency)}
                </span>
              </span>
              {chosen === s.debt.id && <Check size={20} className="shrink-0 text-accent" aria-hidden />}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={!chosen}
            onClick={() => setPick(NEW)}
            className="flex min-h-13 w-full items-center gap-3 px-4 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Новый человек</span>
              {kind === 'repay' && <span className="block text-caption text-muted">Долг не записан — заведётся вместе с возвратом</span>}
            </span>
            {!chosen && <Check size={20} className="shrink-0 text-accent" aria-hidden />}
          </button>
        </div>
        {otherCurrency > 0 && (
          <p className="text-caption text-muted">
            {otherCurrency === 1 ? 'Ещё один долг' : `Ещё ${otherCurrency} долгов`} в другой валюте — их видно со счёта в той валюте.
          </p>
        )}
        {!chosen && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={personLabel[type][kind]}>
              {(id) => <TextInput id={id} autoFocus value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Имя" />}
            </Field>
            {kind === 'grow' ? (
              <Field label="Вернуть до">{(id) => <TextInput id={id} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}</Field>
            ) : (
              <Field label="Всего долг" hint={totalOk ? (total.trim() === '' ? 'Пусто — весь долг, закроется' : undefined) : `Не меньше ${amountLabel}`}>
                {(id) => <TextInput id={id} inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder={amountLabel} />}
              </Field>
            )}
          </div>
        )}
        <Button
          className="w-full"
          disabled={!valid}
          onClick={() => {
            if (!valid) return;
            onDone(
              chosen
                ? { kind, direction, debtId: chosen }
                : kind === 'grow'
                  ? { kind, direction, person: person.trim(), ...(dueDate ? { dueDate } : {}) }
                  : { kind, direction, person: person.trim(), opening: opening! },
            );
            onClose();
          }}
        >
          Сохранить в долги
        </Button>
      </div>
    </Sheet>
  );
}
