import { ArrowRight, CalendarDays, Check, ChevronDown, Ellipsis, MessageSquare, Pencil } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { BASE_CURRENCY, currencyInfo, isBase } from '../../domain/currency';
import { formatRelativeDate } from '../../domain/date';
import { currencyLabel, formatInput, formatMoney, formatRate, formatRatePrecise, inputToMinor, minorToInput, parseRateText, pressKey } from '../../domain/money';
import { defaultAccount, defaultTransferTarget, topCategories } from '../../domain/quickEntry';
import { crossRate, foreignOfPayment, paymentCurrencies, paymentToAccount, toKgs, transferRate } from '../../domain/rate';
import type { Account, Currency, Debt, Id, Rate, Transaction } from '../../domain/types';
import { debtFlow, isDebtCategory } from '../../domain/debts';
import { DebtLinkSheet, type DebtLink } from './DebtLinkSheet';
import { Segmented } from '../../ui/controls';
import { Icon, IconCircle } from '../../ui/icons';
import { Keypad } from '../../ui/Keypad';
import { Sheet } from '../../ui/Sheet';
import { ValueSheet } from '../../ui/ValueSheet';
import { AccountPicker, CategorySheet, CategoryTile, DatePicker, NoteSheet } from './pickers';

/** Что вводится в форме: долги — отдельным экраном (этап 17). */
export type EntryType = 'expense' | 'income' | 'transfer';

type Picker = 'account' | 'toAccount' | 'date' | 'note' | 'category' | 'currency' | 'rate' | 'debt' | null;

/**
 * Форма операции (SPEC 5.2). Расход и доход: сумма своей клавиатурой → категория → «Сохранить».
 * Перевод: «Откуда → Куда»; при разных валютах — поле «Зачислено» и курс, который считается сам (SPEC 4.2).
 * Трата и доход — в любой валюте (этап 16): сумма пересчитывается в валюту счёта по курсу, курс по умолчанию последний.
 */
export function EntryForm({
  initial,
  initialType = 'expense',
  initialAccountId,
  initialToAccountId,
  initialDate,
  onSave,
  footerExtra,
}: {
  initial?: Transaction;
  initialType?: EntryType;
  initialAccountId?: Id;
  initialToAccountId?: Id;
  initialDate?: string;
  /** newDebt — запись с категорией «Долг» открыла новый долг (этап 19). */
  onSave: (tx: Transaction, newDebt?: Debt) => void | Promise<void>;
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
    initial?.toAccountId ??
      (type === 'transfer'
        ? (selectable.find((a) => a.id === initialToAccountId && a.id !== accountId)?.id ?? defaultTransferTarget(accountId, data.transactions, data.accounts)?.id ?? '')
        : ''),
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
    // Категория «Долг» — сначала спросить, кто и что это; запись уйдёт в «Долги» (этап 19).
    if (type !== 'transfer' && isDebtCategory(data.categoryById.get(categoryId!))) return setPicker('debt');
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

  /** Запись «Долг» → операция долга (не расход и не доход) в валюте счёта; новый человек — новый долг (при возврате — сразу с суммой «всего»). */
  const saveDebt = (link: DebtLink) => {
    if (!account || type === 'transfer' || converted === undefined) return;
    const now = Date.now();
    const newDebt: Debt | undefined = link.debtId
      ? undefined
      : {
          id: crypto.randomUUID(),
          direction: link.direction,
          person: link.person!,
          currency,
          opening: link.opening ?? 0,
          date,
          ...(link.dueDate ? { dueDate: link.dueDate } : {}),
          createdAt: now,
        };
    const debtId = link.debtId ?? newDebt!.id;
    const person = newDebt?.person ?? data.debts.find((d) => d.id === debtId)?.person;
    const tx: Transaction = {
      id: initial?.id ?? crypto.randomUUID(),
      type: 'debt',
      debtId,
      flow: debtFlow(link.direction, link.kind),
      date,
      accountId: account.id,
      amount: converted,
      note: note || person,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    const result = onSave(tx, newDebt);
    if (result) {
      setSaving(true);
      void result.finally(() => setSaving(false));
    }
  };

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

  // Показываем набранное как есть: «12,0» не схлопывается в «12», следующая цифра не прыгает в «12,05».
  const show = (value: string, minor: number) => (minor > 0 || value.includes(',') ? formatInput(value) : '0');
  const sign = type === 'expense' ? '−' : type === 'income' ? '+' : '';
  const amountText = typed > 0 ? `${sign}${show(input, typed)}` : '0';
  const amountColor = typed === 0 ? 'text-muted' : type === 'income' ? 'text-income' : 'text-ink';
  const currencies = account && isFlow ? paymentCurrencies(currency) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 pt-1.5 pb-2">
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
          className={`block w-full rounded-card pt-2.5 text-center ${crossCurrency && field === 'from' ? 'bg-sunk ring-2 ring-accent' : ''}`}
          aria-label={`Сумма ${typed > 0 ? amountText : 'ноль'} ${currencyLabel(pay)}`}
        >
          <span aria-live="polite" className={`display-num block text-entry tracking-[-0.02em] ${amountColor}`}>
            {amountText}
          </span>
          {!isFlow && <span className="block pt-1 text-caption text-muted">{currencyLabel(currency)}</span>}
        </button>
        {isFlow && (
          // Зоны нажатия 44 px, но по высоте — как подпись: отрицательные отступы, чтобы клавиатура не съела ряд «Счёт · Дата».
          <div className="-mt-4 flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPicker('currency')}
              aria-label={`Валюта: ${currencyInfo(pay).name}`}
              className="-my-3 flex min-h-11 min-w-11 items-center justify-center gap-0.5 rounded-ctl px-2 text-caption text-muted active:bg-sunk"
            >
              {currencyLabel(pay)}
              <ChevronDown size={16} aria-hidden />
            </button>
            {foreign && (
              <button
                type="button"
                onClick={() => setPicker('rate')}
                aria-label={flowRate ? `Курс ${currencyLabel(foreign)}: ${formatRate(flowRate)}. Изменить` : `Указать курс ${currencyLabel(foreign)}`}
                className={`tabular relative -mt-3 -mb-3 flex min-h-11 items-center gap-1.5 rounded-ctl px-2 text-caption active:bg-sunk ${needsRate ? 'font-semibold text-warn' : 'text-muted'}`}
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
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <AccountCard label="Откуда" account={account} onClick={() => setPicker('account')} />
              <ArrowRight size={18} className="shrink-0 text-muted" aria-hidden />
              <AccountCard label="Куда" account={toAccount} onClick={() => setPicker('toAccount')} />
            </div>
            <p className="text-center text-[12px] text-muted">Перевод не считается расходом и не уменьшает лимит</p>
            {crossCurrency && toAccount && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setField('to');
                    setProblem(null);
                  }}
                  className={`flex min-h-12 w-full items-center justify-between rounded-ctl bg-sunk px-4 text-left ${
                    field === 'to' ? 'ring-2 ring-accent' : problem === 'toAmount' ? 'ring-2 ring-warn' : ''
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
              className={`grid grid-cols-3 gap-2 rounded-card ${problem === 'category' && !categoryId ? 'ring-2 ring-warn ring-offset-2 ring-offset-surface' : ''}`}
            >
              {grid.map((c) => (
                <CategoryTile key={c.id} category={c} selected={c.id === categoryId} onClick={() => setCategoryId(c.id)} />
              ))}
              <button
                type="button"
                onClick={() => setPicker('category')}
                className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-ctl border-[1.5px] border-line px-1 py-1.5 text-caption font-medium"
              >
                <Ellipsis size={20} className="text-muted" aria-hidden />
                Ещё…
              </button>
            </div>
            {problem === 'category' && !categoryId && <p className="mt-2 text-center text-caption text-warn">Выберите категорию</p>}
          </div>
        )}

        {/* Счёт, дата, комментарий — пилюли на --sunk, переносятся по строкам. */}
        <div className="flex flex-wrap gap-1.5">
          {account && type !== 'transfer' && (
            <Pill onClick={() => setPicker('account')} label={`Счёт: ${account.name}`}>
              <Icon name={account.icon} size={14} />
              <span className="truncate">{account.name}</span>
            </Pill>
          )}
          <Pill onClick={() => setPicker('date')} label={`Дата: ${formatRelativeDate(date, today)}`}>
            <CalendarDays size={14} className="shrink-0" aria-hidden />
            <span className="truncate">{formatRelativeDate(date, today)}</span>
          </Pill>
          <Pill onClick={() => setPicker('note')} label={note ? `Комментарий: ${note}` : 'Добавить комментарий'} muted={!note}>
            <MessageSquare size={14} className="shrink-0" aria-hidden />
            <span className="truncate">{note || 'Комментарий'}</span>
          </Pill>
        </div>
      </div>
      <div className="space-y-2.5 bg-surface px-4 pt-1 pb-2">
        <Keypad currency={activeCurrency} onKey={(k) => setActive((s) => pressKey(s, k, activeCurrency))} />
        {/* «Сохранить» активна только при сумме > 0 и выбранной категории; у перевода — только сумма. */}
        <button
          type="button"
          onClick={save}
          disabled={typed <= 0 || saving || (type !== 'transfer' && !categoryId)}
          className="h-14 w-full rounded-ctl bg-primary [@media(max-height:740px)]:h-12 text-[17px] font-semibold text-on-primary transition-colors duration-150 active:opacity-80 disabled:bg-sunk disabled:text-muted"
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
      {picker === 'debt' && type !== 'transfer' && converted !== undefined && (
        <DebtLinkSheet
          type={type}
          currency={currency}
          amount={converted}
          amountLabel={formatMoney(converted, currency)}
          onDone={saveDebt}
          onClose={() => setPicker(null)}
        />
      )}
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
        <CategorySheet categories={kindCategories} kind={type === 'income' ? 'income' : 'expense'} value={categoryId} onPick={setCategoryId} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}

/** Пилюля «счёт · дата · комментарий»: 34 px, --sunk, 13/500. */
function Pill({ onClick, label, muted = false, children }: { onClick: () => void; label: string; muted?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex min-h-[34px] max-w-full items-center gap-1 rounded-full bg-sunk px-3 text-caption font-medium active:bg-line ${muted ? 'text-muted' : 'text-ink'}`}
    >
      {children}
    </button>
  );
}

function AccountCard({ label, account, onClick }: { label: string; account: Account | undefined; onClick: () => void }) {
  const { balances } = useData();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${account?.name ?? 'не выбран'}`}
      className="flex min-h-16 min-w-0 flex-1 items-center gap-2 rounded-ctl bg-sunk px-3 text-left"
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
