import { useState } from 'react';
import { useToday } from '../../app/nav';
import { createDebt, saveDebt } from '../../data/debts';
import { useData } from '../../data/DataProvider';
import { BASE_CURRENCY, CURRENCIES } from '../../domain/currency';
import { currencyLabel, parseMoneyText } from '../../domain/money';
import type { Currency, Debt } from '../../domain/types';
import { Button, Field, inputClass, Segmented, TextInput } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';

const NO_ACCOUNT = '';

/** Новый долг или правка «кто, срок, заметка» (этап 17). Суммы меняются операциями «вернули» / «дал ещё». */
export function DebtEditor({ debt, initialDirection = 'owedToMe', onClose }: { debt?: Debt; initialDirection?: Debt['direction']; onClose: () => void }) {
  const today = useToday();
  const { accounts } = useData();
  const active = accounts.filter((a) => !a.archived);
  const [direction, setDirection] = useState<Debt['direction']>(debt?.direction ?? initialDirection);
  const [person, setPerson] = useState(debt?.person ?? '');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(active[0]?.id ?? NO_ACCOUNT);
  const [freeCurrency, setFreeCurrency] = useState<Currency>(BASE_CURRENCY);
  const [date, setDate] = useState(debt?.date ?? today);
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? '');
  const [note, setNote] = useState(debt?.note ?? '');

  const account = active.find((a) => a.id === accountId);
  const currency = debt?.currency ?? account?.currency ?? freeCurrency;
  const value = parseMoneyText(amount);
  const valid = person.trim() !== '' && (debt ? true : value !== null && value > 0) && (!dueDate || dueDate >= date);
  const owed = direction === 'owedToMe';

  const save = async () => {
    if (!valid) return;
    const next: Debt = {
      ...(debt ?? { id: crypto.randomUUID(), opening: 0, createdAt: Date.now() }),
      direction,
      person: person.trim(),
      currency,
      date,
    };
    if (dueDate) next.dueDate = dueDate;
    else delete next.dueDate;
    if (note.trim()) next.note = note.trim();
    else delete next.note;
    if (debt) await saveDebt(next);
    else await createDebt(next, value!, account?.id);
    onClose();
  };

  return (
    <Sheet
      title={debt ? 'Долг' : 'Новый долг'}
      onClose={onClose}
      full
      footer={
        <Button className="w-full" disabled={!valid} onClick={() => void save()}>
          Сохранить
        </Button>
      }
    >
      <div className="space-y-5 pt-1">
        {!debt && (
          <Segmented
            label="Кто кому должен"
            value={direction}
            onChange={setDirection}
            options={[
              { value: 'owedToMe', label: 'Мне должны' },
              { value: 'iOwe', label: 'Я должен' },
            ]}
          />
        )}
        <Field label={owed ? 'Кто должен' : 'Кому должен'}>
          {(id) => <TextInput id={id} value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Имя" />}
        </Field>
        {!debt && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Сумма, ${currencyLabel(currency)}`}>
                {(id) => <TextInput id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />}
              </Field>
              <Field label={owed ? 'С какого счёта' : 'На какой счёт'}>
                {(id) => (
                  <select id={id} className={`${inputClass} appearance-none`} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                    {active.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                    <option value={NO_ACCOUNT}>Без счёта</option>
                  </select>
                )}
              </Field>
            </div>
            {!account && (
              <Field label="Валюта" hint="Без счёта деньги по счетам не двигаются: долг был раньше или наличные не учитываются">
                {(id) => (
                  <select id={id} className={`${inputClass} appearance-none`} value={freeCurrency} onChange={(e) => setFreeCurrency(e.target.value)}>
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label} — {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Когда">{(id) => <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="Вернуть до">{(id) => <TextInput id={id} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}</Field>
        </div>
        <Field label="Заметка">{(id) => <TextInput id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="За что, на что" />}</Field>
      </div>
    </Sheet>
  );
}
