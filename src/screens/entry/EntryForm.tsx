import { CalendarDays, MessageSquare, MoreHorizontal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { formatRelativeDate } from '../../domain/date';
import { currencyLabel, formatAmount, inputToMinor, minorToInput, pressKey } from '../../domain/money';
import { defaultAccount, topCategories } from '../../domain/quickEntry';
import type { Id, Transaction } from '../../domain/types';
import { Chip, Segmented } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { Keypad } from '../../ui/Keypad';
import { AccountPicker, CategorySheet, CategoryTile, DatePicker, NoteSheet } from './pickers';

export type EntryType = 'expense' | 'income';

type Picker = 'account' | 'date' | 'note' | 'category' | null;

/** Форма операции: сумма своей клавиатурой → категория → «Сохранить» (SPEC 5.2). */
export function EntryForm({
  initial,
  initialType = 'expense',
  initialAccountId,
  onSave,
  footerExtra,
  saveLabel = 'Сохранить',
}: {
  initial?: Transaction;
  initialType?: EntryType;
  initialAccountId?: Id;
  onSave: (tx: Transaction) => void;
  footerExtra?: ReactNode;
  saveLabel?: string;
}) {
  const data = useData();
  const today = useToday();
  const activeAccounts = data.accounts.filter((a) => !a.archived || a.id === initial?.accountId);

  const [type, setType] = useState<EntryType>((initial?.type as EntryType | undefined) ?? initialType);
  const pickDefaultAccount = (t: EntryType) =>
    activeAccounts.find((a) => a.id === initialAccountId)?.id ?? defaultAccount(t, data.transactions, data.accounts)?.id ?? '';
  const [accountId, setAccountId] = useState<Id>(initial?.accountId ?? pickDefaultAccount(type));
  const account = data.accountById.get(accountId);
  const currency = account?.currency ?? 'KGS';
  const [input, setInput] = useState(initial ? minorToInput(initial.amount, currency) : '');
  const [categoryId, setCategoryId] = useState<Id | undefined>(initial?.categoryId);
  const [date, setDate] = useState(initial?.date ?? today);
  const [note, setNote] = useState(initial?.note ?? '');
  const [picker, setPicker] = useState<Picker>(null);
  const [needCategory, setNeedCategory] = useState(false);

  const amount = inputToMinor(input);
  const top = useMemo(() => topCategories(type, data.transactions, data.categories, today), [type, data.transactions, data.categories, today]);
  const selected = categoryId ? data.categoryById.get(categoryId) : undefined;
  const grid = selected && !top.some((c) => c.id === selected.id) ? [...top.slice(0, 4), selected] : top;
  const kindCategories = data.categories.filter((c) => c.kind === type && !c.archived);

  const changeType = (t: EntryType) => {
    setType(t);
    setCategoryId(undefined);
    if (!initial && !initialAccountId) setAccountId(pickDefaultAccount(t));
  };

  const changeAccount = (id: Id) => {
    const next = data.accountById.get(id);
    if (next && next.currency !== currency) setInput(minorToInput(amount, next.currency));
    setAccountId(id);
  };

  const save = useCallback(() => {
    if (amount <= 0 || !account) return;
    if (!categoryId) {
      setNeedCategory(true);
      return;
    }
    const now = Date.now();
    onSave({
      ...(initial ?? {}),
      id: initial?.id ?? crypto.randomUUID(),
      type,
      date,
      accountId: account.id,
      amount,
      categoryId,
      note: note || undefined,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  }, [amount, account, categoryId, initial, type, date, note, onSave]);

  // Аппаратная клавиатура (iPad, Mac, тесты): цифры, запятая, Backspace, Enter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (picker || (e.target instanceof HTMLElement && e.target.closest('input, textarea, select'))) return;
      if (/^\d$/.test(e.key)) setInput((s) => pressKey(s, e.key, currency));
      else if (e.key === ',' || e.key === '.') setInput((s) => pressKey(s, ',', currency));
      else if (e.key === 'Backspace') setInput((s) => pressKey(s, 'back', currency));
      else if (e.key === 'Enter') save();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picker, currency, save]);

  const sign = type === 'expense' ? '−' : '+';
  const amountText = amount > 0 ? `${sign}${formatAmount(amount)}${input.endsWith(',') ? ',' : ''}` : '0';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-2">
        <Segmented
          label="Тип операции"
          value={type}
          onChange={changeType}
          options={[
            { value: 'expense', label: 'Расход' },
            { value: 'income', label: 'Доход' },
          ]}
        />
        <div className="text-center">
          <p
            aria-live="polite"
            aria-label={`Сумма ${amount > 0 ? amountText : 'ноль'} ${currencyLabel(currency)}`}
            className={`tabular text-entry font-semibold ${amount === 0 ? 'text-muted' : type === 'income' ? 'text-income' : 'text-ink'}`}
          >
            {amountText}
          </p>
          <p className="text-caption text-muted">{currencyLabel(currency)}</p>
        </div>
        <div>
          <div role="radiogroup" aria-label="Категория" className={`grid grid-cols-3 gap-2 rounded-2xl ${needCategory && !categoryId ? 'ring-2 ring-warn ring-offset-2 ring-offset-bg' : ''}`}>
            {grid.map((c) => (
              <CategoryTile key={c.id} category={c} selected={c.id === categoryId} onClick={() => setCategoryId(c.id)} />
            ))}
            <button
              type="button"
              onClick={() => setPicker('category')}
              className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-2xl bg-surface px-1 py-1.5"
            >
              <span className="flex size-[26px] items-center justify-center rounded-full bg-line text-muted">
                <MoreHorizontal size={16} aria-hidden />
              </span>
              <span className="text-caption font-medium">Ещё…</span>
            </button>
          </div>
          {needCategory && !categoryId && <p className="mt-2 text-center text-caption text-warn">Выберите категорию</p>}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {account && (
            <Chip onClick={() => setPicker('account')} aria-label={`Счёт: ${account.name}`}>
              <IconCircle name={account.icon} color={account.color} size={22} />
              {account.name}
            </Chip>
          )}
          <Chip onClick={() => setPicker('date')} aria-label={`Дата: ${formatRelativeDate(date, today)}`}>
            <CalendarDays size={16} aria-hidden />
            {formatRelativeDate(date, today)}
          </Chip>
          <Chip onClick={() => setPicker('note')} aria-label={note ? `Комментарий: ${note}` : 'Добавить комментарий'}>
            <MessageSquare size={16} aria-hidden />
            <span className="max-w-[140px] truncate">{note || 'Комментарий'}</span>
          </Chip>
        </div>
      </div>
      <div className="space-y-2 bg-bg px-4 pt-1 pb-3">
        <Keypad currency={currency} onKey={(k) => setInput((s) => pressKey(s, k, currency))} />
        <button
          type="button"
          onClick={save}
          disabled={amount <= 0}
          className="h-14 w-full rounded-2xl bg-primary text-[17px] font-semibold text-white active:opacity-80 disabled:bg-line disabled:text-muted"
        >
          {saveLabel}
        </button>
        {footerExtra}
      </div>

      {picker === 'account' && (
        <AccountPicker
          title="Счёт"
          accounts={activeAccounts}
          balances={data.balances}
          value={accountId}
          onPick={changeAccount}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'date' && <DatePicker value={date} today={today} onPick={setDate} onClose={() => setPicker(null)} />}
      {picker === 'note' && <NoteSheet value={note} onSave={setNote} onClose={() => setPicker(null)} />}
      {picker === 'category' && (
        <CategorySheet categories={kindCategories} value={categoryId} onPick={setCategoryId} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}
