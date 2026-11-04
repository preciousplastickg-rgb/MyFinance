import { ArrowRight, CalendarDays, MessageSquare, MoreHorizontal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { formatRelativeDate } from '../../domain/date';
import { currencyLabel, formatAmount, formatMoney, formatRate, formatRatePrecise, inputToMinor, minorToInput, pressKey } from '../../domain/money';
import { defaultAccount, defaultTransferTarget, topCategories } from '../../domain/quickEntry';
import { crossRate, transferRate } from '../../domain/rate';
import type { Account, Id, Transaction } from '../../domain/types';
import { Chip, Segmented } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { Keypad } from '../../ui/Keypad';
import { AccountPicker, CategorySheet, CategoryTile, DatePicker, NoteSheet } from './pickers';

export type EntryType = Transaction['type'];

type Picker = 'account' | 'toAccount' | 'date' | 'note' | 'category' | null;

/**
 * Форма операции (SPEC 5.2). Расход и доход: сумма своей клавиатурой → категория → «Сохранить».
 * Перевод: «Откуда → Куда»; при разных валютах — поле «Зачислено» и курс, который считается сам (SPEC 4.2).
 */
export function EntryForm({
  initial,
  initialType = 'expense',
  initialAccountId,
  onSave,
  footerExtra,
}: {
  initial?: Transaction;
  initialType?: EntryType;
  initialAccountId?: Id;
  onSave: (tx: Transaction) => void;
  footerExtra?: ReactNode;
}) {
  const data = useData();
  const today = useToday();
  const selectable = data.accounts.filter((a) => !a.archived || a.id === initial?.accountId || a.id === initial?.toAccountId);

  const [type, setType] = useState<EntryType>(initial?.type ?? initialType);
  const pickDefault = (t: EntryType) =>
    selectable.find((a) => a.id === initialAccountId)?.id ?? defaultAccount(t, data.transactions, data.accounts)?.id ?? '';
  const [accountId, setAccountId] = useState<Id>(initial?.accountId ?? pickDefault(type));
  const [toAccountId, setToAccountId] = useState<Id>(
    initial?.toAccountId ?? (type === 'transfer' ? defaultTransferTarget(accountId, data.transactions, data.accounts)?.id ?? '' : ''),
  );
  const account = data.accountById.get(accountId);
  const toAccount = type === 'transfer' ? data.accountById.get(toAccountId) : undefined;
  const currency = account?.currency ?? 'KGS';
  const toCurrency = toAccount?.currency ?? currency;
  const crossCurrency = type === 'transfer' && !!toAccount && toCurrency !== currency;

  const [input, setInput] = useState(initial ? minorToInput(initial.amount, currency) : '');
  const [toInput, setToInput] = useState(initial?.toAmount && initial.rate ? minorToInput(initial.toAmount, toCurrency) : '');
  const [field, setField] = useState<'from' | 'to'>('from');
  const [categoryId, setCategoryId] = useState<Id | undefined>(initial?.categoryId);
  const [date, setDate] = useState(initial?.date ?? today);
  const [note, setNote] = useState(initial?.note ?? '');
  const [picker, setPicker] = useState<Picker>(null);
  const [problem, setProblem] = useState<'category' | 'toAmount' | null>(null);

  const amount = inputToMinor(input);
  const toAmount = crossCurrency ? inputToMinor(toInput) : amount;
  const rate = crossCurrency ? transferRate({ currency, amount }, { currency: toCurrency, amount: toAmount }) : undefined;
  // Обмен двух валют без сома: курс в сомах не пишется, показываем кросс-курс (SPEC 4.6).
  const cross = crossCurrency && currency !== 'KGS' && toCurrency !== 'KGS' ? crossRate(amount, toAmount) : undefined;
  const activeCurrency = field === 'to' && crossCurrency ? toCurrency : currency;
  const setActive = field === 'to' && crossCurrency ? setToInput : setInput;

  const top = useMemo(
    () => (type === 'transfer' ? [] : topCategories(type, data.transactions, data.categories, today)),
    [type, data.transactions, data.categories, today],
  );
  const selected = categoryId ? data.categoryById.get(categoryId) : undefined;
  const grid = selected && !top.some((c) => c.id === selected.id) ? [...top.slice(0, 4), selected] : top;
  const kindCategories = data.categories.filter((c) => c.kind === type && !c.archived);

  const changeType = (t: EntryType) => {
    setType(t);
    setCategoryId(undefined);
    setProblem(null);
    setField('from');
    if (initial) return;
    const from = initialAccountId ?? defaultAccount(t, data.transactions, data.accounts)?.id ?? accountId;
    setAccountId(from);
    if (t === 'transfer') setToAccountId(defaultTransferTarget(from, data.transactions, data.accounts)?.id ?? '');
  };

  const changeAccount = (id: Id) => {
    const next = data.accountById.get(id);
    if (next && next.currency !== currency) setInput(minorToInput(amount, next.currency));
    setAccountId(id);
    if (type === 'transfer' && id === toAccountId) {
      setToAccountId(defaultTransferTarget(id, data.transactions, data.accounts)?.id ?? '');
    }
    setField('from');
  };
  const changeToAccount = (id: Id) => {
    setToAccountId(id);
    setToInput('');
    setField(data.accountById.get(id)?.currency !== currency ? 'to' : 'from');
  };

  const save = useCallback(() => {
    if (amount <= 0 || !account) return;
    if (type !== 'transfer' && !categoryId) return setProblem('category');
    if (type === 'transfer' && (!toAccount || toAccount.id === account.id)) return setPicker('toAccount');
    if (crossCurrency && toAmount <= 0) {
      setField('to');
      return setProblem('toAmount');
    }
    const now = Date.now();
    const base = { ...(initial ?? {}) };
    delete base.categoryId;
    delete base.toAccountId;
    delete base.toAmount;
    delete base.rate;
    onSave({
      ...base,
      id: initial?.id ?? crypto.randomUUID(),
      type,
      date,
      accountId: account.id,
      amount,
      ...(type === 'transfer' ? { toAccountId: toAccount!.id, toAmount, ...(rate ? { rate } : {}) } : { categoryId }),
      note: note || undefined,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
  }, [amount, account, type, categoryId, toAccount, crossCurrency, toAmount, initial, date, rate, note, onSave]);

  // Аппаратная клавиатура (iPad, Mac, тесты): цифры, запятая, Backspace, Enter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (picker || (e.target instanceof HTMLElement && e.target.closest('input, textarea, select'))) return;
      if (/^\d$/.test(e.key)) setActive((s) => pressKey(s, e.key, activeCurrency));
      else if (e.key === ',' || e.key === '.') setActive((s) => pressKey(s, ',', activeCurrency));
      else if (e.key === 'Backspace') setActive((s) => pressKey(s, 'back', activeCurrency));
      else if (e.key === 'Enter') save();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picker, activeCurrency, setActive, save]);

  const show = (value: string, minor: number) => (minor > 0 ? `${formatAmount(minor)}${value.endsWith(',') ? ',' : ''}` : '0');
  const sign = type === 'expense' ? '−' : type === 'income' ? '+' : '';
  const amountText = amount > 0 ? `${sign}${show(input, amount)}` : '0';
  const amountColor = amount === 0 ? 'text-muted' : type === 'income' ? 'text-income' : 'text-ink';

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
            { value: 'transfer', label: 'Перевод' },
          ]}
        />

        <button
          type="button"
          onClick={() => setField('from')}
          className={`block w-full rounded-card text-center ${crossCurrency && field === 'from' ? 'bg-surface ring-2 ring-accent' : ''}`}
          aria-label={`Сумма ${amount > 0 ? amountText : 'ноль'} ${currencyLabel(currency)}`}
        >
          <span aria-live="polite" className={`tabular block text-entry font-semibold ${amountColor}`}>
            {amountText}
          </span>
          <span className="block text-caption text-muted">
            {currencyLabel(currency)}
            {type === 'transfer' && account ? ` · списать с ${account.name}` : ''}
          </span>
        </button>

        {type === 'transfer' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AccountCard label="Откуда" account={account} onClick={() => setPicker('account')} />
              <ArrowRight size={20} className="shrink-0 text-muted" aria-hidden />
              <AccountCard label="Куда" account={toAccount} onClick={() => setPicker('toAccount')} />
            </div>
            {crossCurrency && toAccount && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setField('to');
                    setProblem(null);
                  }}
                  className={`flex min-h-12 w-full items-center justify-between rounded-card bg-surface px-4 text-left ${
                    field === 'to' ? 'ring-2 ring-accent' : problem === 'toAmount' ? 'ring-2 ring-warn' : 'ring-1 ring-line'
                  }`}
                >
                  <span className="text-muted">Зачислено на {toAccount.name}</span>
                  <span className={`tabular text-h2 font-semibold ${toAmount ? '' : 'text-muted'}`}>
                    {show(toInput, toAmount)} {currencyLabel(toCurrency)}
                  </span>
                </button>
                <p className="text-center text-caption text-muted" aria-live="polite">
                  {rate
                    ? `Курс ${formatRate(rate)} сом за 1 ${currencyLabel(currency === 'KGS' ? toCurrency : currency)}`
                    : cross
                      ? `1 ${currencyLabel(currency)} = ${formatRatePrecise(cross)} ${currencyLabel(toCurrency)}`
                      : 'Введите обе суммы — курс посчитается сам'}
                </p>
              </>
            )}
          </div>
        ) : (
          <div>
            <div
              role="radiogroup"
              aria-label="Категория"
              className={`grid grid-cols-3 gap-2 rounded-card ${problem === 'category' && !categoryId ? 'ring-2 ring-warn ring-offset-2 ring-offset-bg' : ''}`}
            >
              {grid.map((c) => (
                <CategoryTile key={c.id} category={c} selected={c.id === categoryId} onClick={() => setCategoryId(c.id)} />
              ))}
              <button
                type="button"
                onClick={() => setPicker('category')}
                className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-card bg-surface px-1 py-1.5"
              >
                <span className="flex size-[26px] items-center justify-center rounded-full bg-line text-muted">
                  <MoreHorizontal size={16} aria-hidden />
                </span>
                <span className="text-caption font-medium">Ещё…</span>
              </button>
            </div>
            {problem === 'category' && !categoryId && <p className="mt-2 text-center text-caption text-warn">Выберите категорию</p>}
          </div>
        )}

        {/* Счёт, дата, комментарий — одной строкой равных ячеек, без переноса и прокрутки. */}
        <div className={`grid gap-2 ${account && type !== 'transfer' ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {account && type !== 'transfer' && (
            <Chip className="min-w-0 justify-center" onClick={() => setPicker('account')} aria-label={`Счёт: ${account.name}`}>
              <IconCircle name={account.icon} color={account.color} size={20} />
              <span className="truncate">{account.name}</span>
            </Chip>
          )}
          <Chip className="min-w-0 justify-center" onClick={() => setPicker('date')} aria-label={`Дата: ${formatRelativeDate(date, today)}`}>
            <CalendarDays size={16} className="shrink-0" aria-hidden />
            <span className="truncate">{formatRelativeDate(date, today)}</span>
          </Chip>
          <Chip className="min-w-0 justify-center" onClick={() => setPicker('note')} aria-label={note ? `Комментарий: ${note}` : 'Добавить комментарий'}>
            <MessageSquare size={16} className="shrink-0" aria-hidden />
            <span className="truncate">{note || 'Комментарий'}</span>
          </Chip>
        </div>
      </div>
      <div className="space-y-2 bg-bg px-4 pt-1 pb-3">
        <Keypad currency={activeCurrency} onKey={(k) => setActive((s) => pressKey(s, k, activeCurrency))} />
        <button
          type="button"
          onClick={save}
          disabled={amount <= 0}
          className="h-14 w-full rounded-card bg-primary text-[17px] font-semibold text-white active:opacity-80 disabled:bg-line disabled:text-muted"
        >
          Сохранить
        </button>
        {footerExtra}
      </div>

      {picker === 'account' && (
        <AccountPicker
          title={type === 'transfer' ? 'Откуда' : 'Счёт'}
          accounts={selectable}
          balances={data.balances}
          value={accountId}
          onPick={changeAccount}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'toAccount' && (
        <AccountPicker
          title="Куда"
          accounts={selectable.filter((a) => a.id !== accountId)}
          balances={data.balances}
          value={toAccountId}
          onPick={changeToAccount}
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

function AccountCard({ label, account, onClick }: { label: string; account: Account | undefined; onClick: () => void }) {
  const { balances } = useData();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${account?.name ?? 'не выбран'}`}
      className="flex min-h-[64px] min-w-0 flex-1 items-center gap-2 rounded-card bg-surface px-3 text-left ring-1 ring-line"
    >
      {account ? (
        <>
          <IconCircle name={account.icon} color={account.color} size={30} dashed={account.currency !== 'KGS'} />
          <span className="min-w-0">
            <span className="block text-caption text-muted">{label}</span>
            <span className="block truncate font-medium">{account.name}</span>
            <span className="tabular block truncate text-caption text-muted">{formatMoney(balances.get(account.id) ?? 0, account.currency)}</span>
          </span>
        </>
      ) : (
        <span className="text-muted">{label}: выбрать</span>
      )}
    </button>
  );
}
