import { ArrowRight, CalendarDays, Check, ChevronDown, MessageSquare, MoreHorizontal, Pencil } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { BASE_CURRENCY, currencyInfo, isBase } from '../../domain/currency';
import { formatRelativeDate } from '../../domain/date';
import { currencyLabel, formatAmount, formatMoney, formatRate, formatRatePrecise, inputToMinor, minorToInput, parseRateText, pressKey } from '../../domain/money';
import { defaultAccount, defaultTransferTarget, topCategories } from '../../domain/quickEntry';
import { crossRate, foreignOfPayment, paymentCurrencies, paymentToAccount, toKgs, transferRate } from '../../domain/rate';
import type { Account, Currency, Id, Rate, Transaction } from '../../domain/types';
import { Chip, Segmented } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { Keypad } from '../../ui/Keypad';
import { Sheet } from '../../ui/Sheet';
import { ValueSheet } from '../../ui/ValueSheet';
import { AccountPicker, CategorySheet, CategoryTile, DatePicker, NoteSheet } from './pickers';

/** Что вводится в форме: долги — отдельным экраном (этап 17). */
export type EntryType = 'expense' | 'income' | 'transfer';

type Picker = 'account' | 'toAccount' | 'date' | 'note' | 'category' | 'currency' | 'rate' | null;

/**
 * Форма операции (SPEC 5.2). Расход и доход: сумма своей клавиатурой → категория → «Сохранить».
 * Перевод: «Откуда → Куда»; при разных валютах — поле «Зачислено» и курс, который считается сам (SPEC 4.2).
 * Трата и доход — в любой валюте (этап 16): сумма пересчитывается в валюту счёта по курсу, курс по умолчанию последний.
 */
export function EntryForm({
  initial,
  initialType = 'expense',
  initialAccountId,
  initialDate,
  onSave,
  footerExtra,
}: {
  initial?: Transaction;
  initialType?: EntryType;
  initialAccountId?: Id;
  initialDate?: string;
  onSave: (tx: Transaction) => void | Promise<void>;
  footerExtra?: ReactNode;
}) {
  const data = useData();
  const today = useToday();
  const selectable = data.accounts.filter((a) => !a.archived || a.id === initial?.accountId || a.id === initial?.toAccountId);

  const [type, setType] = useState<EntryType>(initial && initial.type !== 'debt' ? initial.type : initialType);
  const pickDefault = (t: EntryType) =>
    selectable.find((a) => a.id === initialAccountId)?.id ?? defaultAccount(t, data.transactions, data.accounts)?.id ?? '';
  const [accountId, setAccountId] = useState<Id>(initial?.accountId ?? pickDefault(type));
  const [toAccountId, setToAccountId] = useState<Id>(
    initial?.toAccountId ?? (type === 'transfer' ? defaultTransferTarget(accountId, data.transactions, data.accounts)?.id ?? '' : ''),
  );
  const account = data.accountById.get(accountId);
  const toAccount = type === 'transfer' ? data.accountById.get(toAccountId) : undefined;
  const currency = account?.currency ?? BASE_CURRENCY;
  const toCurrency = toAccount?.currency ?? currency;
  const crossCurrency = type === 'transfer' && !!toAccount && toCurrency !== currency;

  const [payCurrency, setPayCurrency] = useState<Currency>(initial?.origCurrency ?? currency);
  const [customRate, setCustomRate] = useState<Rate | undefined>(initial && initial.type !== 'transfer' ? initial.rate : undefined);
  const [input, setInput] = useState(initial ? minorToInput(initial.origAmount ?? initial.amount, initial.origCurrency ?? currency) : '');
  // Обмен двух валют без сома курса не хранит, но «Зачислено» у него своё — его тоже показываем при правке.
  const [toInput, setToInput] = useState(initial?.toAmount && toCurrency !== currency ? minorToInput(initial.toAmount, toCurrency) : '');
  const [field, setField] = useState<'from' | 'to'>('from');
  const [categoryId, setCategoryId] = useState<Id | undefined>(initial?.categoryId);
  const [date, setDate] = useState(initial?.date ?? initialDate ?? today);
  const [note, setNote] = useState(initial?.note ?? '');
  const [picker, setPicker] = useState<Picker>(null);
  const [problem, setProblem] = useState<'category' | 'toAmount' | null>(null);
  const [saving, setSaving] = useState(false);

  const typed = inputToMinor(input);
  const toAmount = crossCurrency ? inputToMinor(toInput) : typed;
  const rate = crossCurrency ? transferRate({ currency, amount: typed }, { currency: toCurrency, amount: toAmount }) : undefined;
  // Обмен двух валют без сома: курс в сомах не пишется, показываем кросс-курс (SPEC 4.6).
  const cross = crossCurrency && !isBase(currency) && !isBase(toCurrency) ? crossRate(typed, toAmount) : undefined;

  // Трата и доход: валюта платежа, курс к сому и сумма в валюте счёта.
  const isFlow = type !== 'transfer';
  const pay = isFlow ? payCurrency : currency;
  const foreign = isFlow ? foreignOfPayment(pay, currency) : undefined;
  const lastRate = foreign ? data.rateFor(foreign) : undefined;
  const flowRate = foreign ? (customRate ?? lastRate) : undefined;
  const converted = isFlow ? paymentToAccount(typed, pay, currency, flowRate) : typed;
  const needsRate = isFlow && pay !== currency && converted === undefined;
  const activeCurrency = field === 'to' && crossCurrency ? toCurrency : pay;
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
    if (next) {
      // Валюта платежа идёт за счётом, если совпадала с ним или со счётом новой валюты так платить нельзя.
      const nextPay = pay === currency || !paymentCurrencies(next.currency).includes(pay) ? next.currency : pay;
      if (nextPay !== pay) setInput(minorToInput(typed, nextPay));
      setPayCurrency(nextPay);
      setCustomRate(undefined);
    }
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
    if (saving || typed <= 0 || !account) return;
    if (needsRate) return setPicker('rate');
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
    delete base.origAmount;
    delete base.origCurrency;
    const flow =
      pay !== currency ? { origAmount: typed, origCurrency: pay, rate: flowRate } : flowRate ? { rate: flowRate } : {};
    const result = onSave({
      ...base,
      id: initial?.id ?? crypto.randomUUID(),
      type,
      date,
      accountId: account.id,
      amount: isFlow ? converted! : typed,
      ...(type === 'transfer' ? { toAccountId: toAccount!.id, toAmount, ...(rate ? { rate } : {}) } : { categoryId, ...flow }),
      note: note || undefined,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    });
    // Пока запись идёт в базу, второй тап по «Сохранить» не создаёт дубль.
    if (result) {
      setSaving(true);
      void result.finally(() => setSaving(false));
    }
  }, [saving, typed, account, needsRate, type, categoryId, toAccount, crossCurrency, toAmount, initial, date, rate, note, onSave, pay, currency, flowRate, isFlow, converted]);

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
  const amountText = typed > 0 ? `${sign}${show(input, typed)}` : '0';
  const amountColor = typed === 0 ? 'text-muted' : type === 'income' ? 'text-income' : 'text-ink';
  const currencies = account && isFlow ? paymentCurrencies(currency) : [];

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
          aria-label={`Сумма ${typed > 0 ? amountText : 'ноль'} ${currencyLabel(pay)}`}
        >
          <span aria-live="polite" className={`tabular block text-entry font-semibold ${amountColor}`}>
            {amountText}
          </span>
          {!isFlow && <span className="block text-caption text-muted">{currencyLabel(currency)}</span>}
        </button>
        {isFlow && (
          // Зоны нажатия 44 px, но по высоте — как подпись: отрицательные отступы, чтобы клавиатура не съела ряд «Счёт · Дата».
          <div className="-mt-5 flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPicker('currency')}
              aria-label={`Валюта: ${currencyInfo(pay).name}`}
              className="-my-3 flex min-h-11 min-w-11 items-center justify-center gap-0.5 rounded-ctl px-2 text-caption font-semibold text-accent active:bg-line"
            >
              {currencyLabel(pay)}
              <ChevronDown size={16} aria-hidden />
            </button>
            {foreign && (
              <button
                type="button"
                onClick={() => setPicker('rate')}
                aria-label={flowRate ? `Курс ${currencyLabel(foreign)}: ${formatRate(flowRate)}. Изменить` : `Указать курс ${currencyLabel(foreign)}`}
                className={`tabular relative -mt-3 -mb-3 flex min-h-11 items-center gap-1.5 rounded-ctl px-2 text-caption active:bg-line ${needsRate ? 'font-semibold text-warn' : 'text-muted'}`}
              >
                {pay !== currency
                  ? converted !== undefined && flowRate
                    ? `= ${formatMoney(converted, currency)} с ${account?.name ?? 'счёта'} · курс ${formatRate(flowRate)}`
                    : `Укажите курс ${currencyLabel(foreign)}`
                  : flowRate
                    ? `≈ ${formatMoney(toKgs(typed, flowRate), BASE_CURRENCY)} · курс ${formatRate(flowRate)}`
                    : 'Курс не указан — отчёты возьмут последний обмен'}
                <Pencil size={13} className="shrink-0" aria-hidden />
              </button>
            )}
          </div>
        )}

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
                    ? `Курс ${formatRate(rate)} сом за 1 ${currencyLabel(isBase(currency) ? toCurrency : currency)}`
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
          disabled={typed <= 0 || saving}
          className="h-14 w-full rounded-card bg-primary [@media(max-height:740px)]:h-12 text-[17px] font-semibold text-white active:opacity-80 disabled:bg-line disabled:text-muted"
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
      {picker === 'currency' && (
        <Sheet title="Валюта" onClose={() => setPicker(null)}>
          <ul className="divide-y divide-line" aria-label="Валюты">
            {currencies.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => {
                    if (c !== pay) setInput(minorToInput(typed, c));
                    setPayCurrency(c);
                    setCustomRate(undefined);
                    setPicker(null);
                  }}
                  className="flex min-h-13 w-full items-center gap-3 text-left"
                >
                  <span className="w-12 font-semibold">{currencyLabel(c)}</span>
                  <span className="flex-1 text-muted">
                    {currencyInfo(c).name}
                    {c === currency ? ' · валюта счёта' : ''}
                  </span>
                  {c === pay && <Check size={20} className="text-accent" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
      {picker === 'rate' && foreign && (
        <ValueSheet
          title={`Курс ${currencyLabel(foreign)}`}
          label={`Сом за 1 ${currencyLabel(foreign)}`}
          hint={lastRate ? `Последний курс — ${formatRate(lastRate)}. Он подставляется сам, если не менять.` : 'Курса этой валюты ещё нет — укажите его.'}
          initial={flowRate ? formatRate(flowRate) : ''}
          parse={parseRateText}
          onSave={(r) => setCustomRate(r)}
          onClose={() => setPicker(null)}
        />
      )}
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
          <IconCircle name={account.icon} color={account.color} size={30} dashed={!isBase(account.currency)} />
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
