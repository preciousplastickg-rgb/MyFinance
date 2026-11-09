import { useState } from 'react';
import { useToday } from '../../app/nav';
import { createDebt, makeDebtMemo, restoreDebt, saveDebt, setDebtAmount } from '../../data/debts';
import { canMakeMemo, debtMoveTitle, openingMove } from '../../domain/debts';
import { useData } from '../../data/DataProvider';
import { BASE_CURRENCY, CURRENCIES } from '../../domain/currency';
import { currencyLabel, formatMoney, minorToText, parseMoneyText } from '../../domain/money';
import type { Currency, Debt } from '../../domain/types';
import { Button, Field, inputClass, Segmented, TextInput } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

type Mode = 'memo' | 'money';

/**
 * Новый долг или правка «кто, сумма, срок, заметка» (этап 17). Возвраты и «дал ещё» — в карточке.
 * «Только запомнить» (по умолчанию, по просьбе пользователя 2026-11-09) — долг-заметка: счета не двигаются,
 * в «Можно потратить» не входит. «Через счёт» — деньги проходят по счёту, но не как доход и не как расход.
 */
export function DebtEditor({ debt, initialDirection = 'owedToMe', onClose }: { debt?: Debt; initialDirection?: Debt['direction']; onClose: () => void }) {
  const today = useToday();
  const toast = useToast();
  const { accounts, transactions, accountById } = useData();
  const active = accounts.filter((a) => !a.archived);
  // Сумма существующего долга — его первая операция (или opening у долга без счёта).
  const opening = debt ? openingMove(debt, transactions) : undefined;
  const openingAmount = debt ? (opening?.amount ?? debt.opening) : 0;
  const [direction, setDirection] = useState<Debt['direction']>(debt?.direction ?? initialDirection);
  const [person, setPerson] = useState(debt?.person ?? '');
  const [amount, setAmount] = useState(debt && openingAmount > 0 ? minorToText(openingAmount) : '');
  const [mode, setMode] = useState<Mode>(debt && !debt.memo ? 'money' : 'memo');
  const [accountId, setAccountId] = useState(active[0]?.id ?? '');
  const [freeCurrency, setFreeCurrency] = useState<Currency>(BASE_CURRENCY);
  const [date, setDate] = useState(debt?.date ?? today);
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? '');
  const [note, setNote] = useState(debt?.note ?? '');

  const memo = mode === 'memo';
  const account = memo ? undefined : active.find((a) => a.id === accountId);
  const currency = debt?.currency ?? account?.currency ?? freeCurrency;
  const value = parseMoneyText(amount);
  const amountEditable = !debt || openingAmount > 0;
  // Существующий долг можно сделать заметкой, пока денег по нему нет, кроме первой операции (её уберёт перевод).
  const convertible = !!debt && canMakeMemo(debt, transactions);
  const valid =
    person.trim() !== '' && (amountEditable ? value !== null && value > 0 : true) && (!dueDate || dueDate >= date) && (!!debt || memo || !!account);
  const owed = direction === 'owedToMe';
  const modeHint = memo
    ? debt && opening && convertible
      ? `Операция «${debtMoveTitle(debt.direction, opening.flow ?? 'out')}» ${accountById.get(opening.accountId)?.name ?? ''} ${formatMoney(opening.amount, debt.currency)} удалится — счёт вернётся как был. В «Можно потратить» не входит.`
      : 'Счета не изменятся. В «Можно потратить» не входит — долг просто будет в «Долгах», со сроком.'
    : debt
      ? opening
        ? undefined
        : 'Сейчас без счёта, но считается на «Сегодня» в карточке «Остаток».'
      : owed
        ? 'Сумма уйдёт со счёта — не как расход.'
        : 'Сумма придёт на счёт — не как доход.';

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
    if (!debt && memo) next.memo = true;
    if (debt && memo && !debt.memo) {
      const before = await makeDebtMemo(next, amountEditable && value !== null ? value : openingAmount, opening);
      toast({ message: `${next.person}: только запомнить`, actionLabel: 'Отменить', onAction: () => void restoreDebt(before) });
    } else if (debt) {
      await saveDebt(next);
      if (amountEditable && value !== null && value !== openingAmount) await setDebtAmount(next, value, opening);
    } else await createDebt(next, value!, account?.id);
    onClose();
  };

  const modeSwitch = (
    <div className="space-y-1.5">
      <Segmented
        label="Как записать долг"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'memo', label: 'Только запомнить' },
          { value: 'money', label: 'Через счёт' },
        ]}
      />
      {modeHint && <p className="px-1 text-caption text-muted">{modeHint}</p>}
    </div>
  );

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
        {(!debt || convertible) && modeSwitch}
        {debt?.memo && <p className="px-1 text-caption text-muted">Только запомнить: счета не меняются, в «Можно потратить» не входит.</p>}
        <Field label={owed ? 'Кто должен' : 'Кому должен'}>
          {(id) => <TextInput id={id} value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Имя" />}
        </Field>
        {debt && amountEditable && (
          <Field
            label={`Сумма, ${currencyLabel(currency)}`}
            hint={
              opening && !memo
                ? `Сумма первой операции (${opening.date}); баланс счёта пересчитается. Возвраты и «дал ещё» — в карточке долга`
                : 'Начальная сумма долга, счета не меняются'
            }
          >
            {(id) => <TextInput id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />}
          </Field>
        )}
        {!debt && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Сумма, ${currencyLabel(currency)}`}>
                {(id) => <TextInput id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />}
              </Field>
              {memo ? (
                <Field label="Валюта">
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
              ) : (
                <Field label={owed ? 'С какого счёта' : 'На какой счёт'} hint={active.length ? undefined : 'Нет счетов'}>
                  {(id) => (
                    <select id={id} className={`${inputClass} appearance-none`} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                      {active.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              )}
            </div>
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
