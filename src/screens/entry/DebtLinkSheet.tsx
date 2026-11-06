import { Check } from 'lucide-react';
import { useState } from 'react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { debtDirectionFor, debtsOverview, type DebtMoveKind } from '../../domain/debts';
import { formatMoney } from '../../domain/money';
import type { Currency, Debt, Id } from '../../domain/types';
import { Button, Field, Segmented, TextInput } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';

export interface DebtLink {
  kind: DebtMoveKind;
  direction: Debt['direction'];
  /** Существующий долг или новый человек. */
  debtId?: Id;
  person?: string;
  dueDate?: string;
}

const NEW = '__new';

/**
 * Запись с категорией «Долг» (этап 19): кто и что это — дал / взял в долг или возврат.
 * Возврат — только по открытому долгу в валюте счёта; новый долг — с именем и сроком.
 */
export function DebtLinkSheet({
  type,
  currency,
  amountLabel,
  onDone,
  onClose,
}: {
  type: 'expense' | 'income';
  currency: Currency;
  amountLabel: string;
  onDone: (link: DebtLink) => void;
  onClose: () => void;
}) {
  const { debts, transactions } = useData();
  const today = useToday();
  const [kind, setKind] = useState<DebtMoveKind>('grow');
  const direction = debtDirectionFor(type, kind);
  const o = debtsOverview(debts, transactions, today);
  const open = (direction === 'owedToMe' ? o.owedToMe : o.iOwe).filter((s) => s.debt.currency === currency);
  const [pick, setPick] = useState<string>(NEW);
  const [person, setPerson] = useState('');
  const [dueDate, setDueDate] = useState('');
  const chosen = kind === 'repay' && pick === NEW ? open[0]?.debt.id : pick === NEW ? undefined : pick;
  const valid = chosen ? open.some((s) => s.debt.id === chosen) : kind === 'grow' && person.trim() !== '';

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
            setPick(NEW);
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
          {kind === 'grow' && (
            <button
              type="button"
              role="radio"
              aria-checked={!chosen}
              onClick={() => setPick(NEW)}
              className="flex min-h-13 w-full items-center gap-3 px-4 text-left"
            >
              <span className="flex-1 font-medium">Новый человек</span>
              {!chosen && <Check size={20} className="shrink-0 text-accent" aria-hidden />}
            </button>
          )}
          {kind === 'repay' && open.length === 0 && (
            <p className="px-4 py-3 text-caption text-muted">Открытых долгов в этой валюте нет — возвращать нечего.</p>
          )}
        </div>
        {kind === 'grow' && !chosen && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={direction === 'owedToMe' ? 'Кому дали' : 'У кого взяли'}>
              {(id) => <TextInput id={id} autoFocus value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Имя" />}
            </Field>
            <Field label="Вернуть до">{(id) => <TextInput id={id} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}</Field>
          </div>
        )}
        <Button
          className="w-full"
          disabled={!valid}
          onClick={() => {
            if (!valid) return;
            onDone(chosen ? { kind, direction, debtId: chosen } : { kind, direction, person: person.trim(), ...(dueDate ? { dueDate } : {}) });
            onClose();
          }}
        >
          Сохранить в долги
        </Button>
      </div>
    </Sheet>
  );
}
