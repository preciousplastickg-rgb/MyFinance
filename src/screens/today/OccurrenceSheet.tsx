import { useState } from 'react';
import { useToday } from '../../app/nav';
import { completeOccurrence, skipOccurrence } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { formatShortDate } from '../../domain/date';
import { currencyLabel, minorToText, parseMoneyText } from '../../domain/money';
import type { Occurrence } from '../../domain/recurring';
import { Button, Field, inputClass, TextInput } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';

/** Поправить сумму и счёт перед записью или «Пропустить» (SPEC 4.3). */
export function OccurrenceSheet({ occurrence, onDone, onClose }: { occurrence: Occurrence; onDone: () => void; onClose: () => void }) {
  const { accounts, accountById } = useData();
  const today = useToday();
  const r = occurrence.recurring;
  const sameCurrency = accounts.filter((a) => !a.archived && a.currency === r.currency);
  const [amount, setAmount] = useState(minorToText(r.amount));
  const [accountId, setAccountId] = useState(accountById.get(r.accountId)?.archived === false ? r.accountId : sameCurrency[0]?.id ?? '');
  const value = parseMoneyText(amount);
  const income = r.kind === 'income';
  const valid = value !== null && value > 0 && !!accountById.get(accountId);

  return (
    <Sheet title={r.name} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-muted">
          {income ? 'Ожидалось' : 'Срок'} {formatShortDate(occurrence.dueDate)}. Запишется сегодняшней датой.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Сумма, ${currencyLabel(r.currency)}`}>
            {(id) => <TextInput id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
          </Field>
          <Field label="Счёт">
            {(id) => (
              <select id={id} className={`${inputClass} appearance-none`} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {sameCurrency.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Button
          className="w-full"
          disabled={!valid}
          onClick={() => {
            if (!valid || value === null) return;
            void completeOccurrence(r, occurrence.dueDate, { amount: value, accountId, date: today }).then(onDone);
            onClose();
          }}
        >
          {income ? 'Пришло' : 'Оплачено'}
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            void skipOccurrence(r.id, occurrence.dueDate);
            onClose();
          }}
        >
          Пропустить
        </Button>
      </div>
    </Sheet>
  );
}
