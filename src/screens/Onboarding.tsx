import { Check, Plus } from '../ui/glyphs';
import { useRef, useState } from 'react';
import { useToday } from '../app/nav';
import { useData } from '../data/DataProvider';
import { completeOnboarding, newId } from '../data/actions';
import { parseBackup, type Backup } from '../domain/backup';
import { DEFAULT_ACCOUNTS, EXTRA_ACCOUNTS } from '../domain/catalog';

const ONBOARDING_ACCOUNTS = [...DEFAULT_ACCOUNTS, ...EXTRA_ACCOUNTS];
import { currencyLabel, formatMoney, parseMoneyText } from '../domain/money';
import { describeSchedule } from '../domain/recurring';
import type { Account, Recurring } from '../domain/types';
import { Button, Chip, ListGroup, Row } from '../ui/controls';
import { IconCircle } from '../ui/icons';
import { RecurringEditor, type RecurringDraft } from './recurring/RecurringEditor';
import { ImportSheet } from './settings/DataSheets';
import { useToast } from '../ui/Toast';
import { isBase } from '../domain/currency';

interface AccountDraft {
  include: boolean;
  balance: string;
}

const PAYMENT_SUGGESTIONS: { name: string; category: string; day: number; subscription?: boolean }[] = [
  { name: 'Аренда квартиры', category: 'Жильё', day: 5 },
  { name: 'Интернет', category: 'Связь и интернет', day: 7 },
  { name: 'Мобильная связь', category: 'Связь и интернет', day: 8 },
  { name: 'Подписка', category: 'Подписки', day: 15, subscription: true },
];

/** Первый запуск: счета с остатками, источники дохода, регулярные платежи. Каждый шаг можно пропустить (SPEC 5.5). */
export function Onboarding() {
  const { categories } = useData();
  const today = useToday();
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<AccountDraft[]>(ONBOARDING_ACCOUNTS.map((_, i) => ({ include: i < DEFAULT_ACCOUNTS.length, balance: '' })));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [editing, setEditing] = useState<RecurringDraft | null>(null);
  const [incoming, setIncoming] = useState<{ backup: Backup; summary: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const buildAccounts = (useBalances: boolean) => {
    const list: Account[] = [];
    ONBOARDING_ACCOUNTS.forEach((a, i) => {
      const d = drafts[i]!;
      // «Пропустить» создаёт 5 стандартных счетов без валютных добавок.
      if (useBalances ? !d.include : i >= DEFAULT_ACCOUNTS.length) return;
      list.push({
        ...a,
        id: newId(),
        openingBalance: useBalances ? (parseMoneyText(d.balance) ?? 0) : 0,
        openingDate: today,
        sortOrder: list.length,
        archived: false,
      });
    });
    setAccounts(list);
    setStep(1);
  };

  const finish = (withRecurring: Recurring[]) => void completeOnboarding(accounts, withRecurring);

  const kind = step === 1 ? 'income' : 'expense';
  const items = recurring.filter((r) => r.kind === kind);
  const categoryByName = (name: string) => categories.find((c) => c.name === name && c.kind === 'expense')?.id;
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '';

  const next = () => (step === 1 ? setStep(2) : finish(recurring));
  const skip = () => {
    if (step === 0) return buildAccounts(false);
    const rest = recurring.filter((r) => r.kind !== kind);
    setRecurring(rest);
    if (step === 1) setStep(2);
    else finish(rest);
  };

  const balancesInvalid = drafts.some((d) => d.include && d.balance.trim() !== '' && parseMoneyText(d.balance) === null);

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-lg flex-col px-4">
      <div className="flex items-center justify-between pt-4">
        <p className="text-caption text-muted">Шаг {step + 1} из 3</p>
        <button type="button" onClick={skip} className="min-h-11 px-2 font-medium text-accent">
          Пропустить
        </button>
      </div>
      <div className="mb-5 flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-[2px] ${i <= step ? 'bg-primary' : 'bg-line'}`} />
        ))}
      </div>

      {step === 0 && (
        <>
          <h1 className="text-h1 font-bold">Счета</h1>
          <p className="mt-1 mb-5 text-muted">Сколько сейчас на каждом счёте. Лишние можно выключить.</p>
          <ListGroup>
            {ONBOARDING_ACCOUNTS.map((a, i) => {
              const d = drafts[i]!;
              const set = (patch: Partial<AccountDraft>) =>
                setDrafts((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div key={a.name} className="flex items-center gap-2 py-2 pr-3 pl-1">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={d.include}
                    aria-label={`Добавить ${a.name}`}
                    onClick={() => set({ include: !d.include })}
                    className="flex size-11 shrink-0 items-center justify-center"
                  >
                    <span className={`flex size-6 items-center justify-center rounded-ctl ${d.include ? 'bg-accent text-white' : 'ring-2 ring-line'}`}>
                      {d.include && <Check size={16} aria-hidden />}
                    </span>
                  </button>
                  <IconCircle name={a.icon} color={a.color} size={32} dashed={!isBase(a.currency)} />
                  <span className={`min-w-0 flex-1 truncate ${d.include ? '' : 'text-muted'}`}>{a.name}</span>
                  <label className="flex items-center gap-1.5">
                    <span className="sr-only">Остаток {a.name}</span>
                    <input
                      inputMode="decimal"
                      disabled={!d.include}
                      value={d.balance}
                      onChange={(e) => set({ balance: e.target.value })}
                      placeholder="0"
                      className="tabular min-h-11 w-[92px] rounded-ctl bg-bg px-3 text-right ring-1 ring-line outline-none focus:ring-2 focus:ring-accent disabled:opacity-40"
                    />
                    <span className="w-9 text-caption text-muted">{currencyLabel(a.currency)}</span>
                  </label>
                </div>
              );
            })}
          </ListGroup>
          <div className="flex-1" />
          <Button
            className="mt-6 w-full"
            disabled={balancesInvalid || drafts.every((d) => !d.include)}
            onClick={() => buildAccounts(true)}
          >
            Дальше
          </Button>
          <Button variant="ghost" className="mt-1 w-full" onClick={() => fileInput.current?.click()}>
            Восстановить из бэкапа
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            aria-label="Файл бэкапа"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const result = await parseBackup(await file.text());
              if (result.ok) setIncoming({ backup: result.backup, summary: result.summary });
              else toast({ message: result.error });
            }}
          />
        </>
      )}

      {step > 0 && (
        <>
          <h1 className="text-h1 font-bold">{step === 1 ? 'Источники дохода' : 'Регулярные платежи'}</h1>
          <p className="mt-1 mb-5 text-muted">
            {step === 1
              ? 'Когда приходят деньги: от этой даты считается лимит на день.'
              : 'Аренда, связь, подписки — чтобы деньги на них не потратились раньше времени.'}
          </p>
          {items.length > 0 && (
            <ListGroup>
              {items.map((r) => {
                const c = categories.find((x) => x.id === r.categoryId);
                return (
                  <Row key={r.id} onClick={() => setEditing(r)}>
                    <IconCircle name={c?.icon ?? 'Ellipsis'} color={c?.color ?? 'slate'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="text-caption text-muted">
                        {describeSchedule(r.schedule)} · {accountName(r.accountId)}
                      </p>
                    </div>
                    <span className="tabular shrink-0">{formatMoney(r.amount, r.currency)}</span>
                  </Row>
                );
              })}
            </ListGroup>
          )}
          {step === 2 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {PAYMENT_SUGGESTIONS.filter((s) => !items.some((r) => r.name === s.name)).map((s) => (
                <Chip
                  key={s.name}
                  onClick={() =>
                    setEditing({
                      kind: 'expense',
                      name: s.name,
                      categoryId: categoryByName(s.category),
                      schedule: { type: 'monthly', day: s.day },
                      isSubscription: s.subscription ?? false,
                    })
                  }
                >
                  <Plus size={16} aria-hidden />
                  {s.name}
                </Chip>
              ))}
            </div>
          )}
          <Button
            variant="secondary"
            className="mt-4 w-full"
            onClick={() =>
              setEditing(step === 1 ? { kind: 'income', name: items.length ? '' : 'Зарплата' } : { kind: 'expense' })
            }
          >
            {step === 1 ? 'Добавить источник дохода' : 'Добавить платёж'}
          </Button>
          <div className="flex-1" />
          <Button className="mt-6 w-full" onClick={next}>
            {step === 1 ? 'Дальше' : 'Готово'}
          </Button>
        </>
      )}

      {incoming && <ImportSheet backup={incoming.backup} summary={incoming.summary} onClose={() => setIncoming(null)} />}
      {editing && (
        <RecurringEditor
          initial={editing}
          accounts={accounts}
          categories={categories}
          today={today}
          onClose={() => setEditing(null)}
          onSave={(r) => setRecurring((prev) => [...prev.filter((x) => x.id !== r.id), r])}
        />
      )}
    </div>
  );
}
