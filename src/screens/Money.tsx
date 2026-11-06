import { ChevronLeft, ChevronRight, Repeat, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNav, useToday } from '../app/nav';
import { deleteTransaction, restoreTransaction } from '../data/actions';
import { useData } from '../data/DataProvider';
import { BASE_CURRENCY } from '../domain/currency';
import { addMonths, formatDayTitle, formatMonthKey, monthOf } from '../domain/date';
import { debtsOverview, totalKgs } from '../domain/debts';
import { activeJars, savingsTotals } from '../domain/savings';
import { groupByDay, latestMonth, matchesQuery, monthTotals, type DayGroup } from '../domain/history';
import { currencyLabel, formatAmount, formatMoney } from '../domain/money';
import type { Transaction } from '../domain/types';
import { Chip } from '../ui/controls';
import { IconCircle } from '../ui/icons';
import { SwipeRow } from '../ui/SwipeRow';
import { useToast } from '../ui/Toast';
import { TransactionRow } from '../ui/TransactionRow';
import { VirtualList } from '../ui/VirtualList';
import { TransactionEditor } from './entry/TransactionEditor';

type ListItem = { kind: 'day'; group: DayGroup } | { kind: 'tx'; tx: Transaction; first: boolean; last: boolean };

export function Money() {
  const data = useData();
  const today = useToday();
  const { moneyAccount, showAccountHistory, push, showReports, moneyMonth, setMoneyMonth } = useNav();
  const toast = useToast();
  // Месяц живёт в nav: после «Регулярных» или итога дня возвращаемся в тот же месяц.
  const month = moneyMonth ?? monthOf(today);
  const setMonth = setMoneyMonth;
  const lastMonth = useMemo(() => latestMonth(data.transactions, today), [data.transactions, today]);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const activeAccounts = data.accounts.filter((a) => !a.archived || a.id === moneyAccount);
  const searching = query.trim() !== '';

  const filtered = useMemo(
    () =>
      data.transactions.filter(
        (t) =>
          (searching || monthOf(t.date) === month) &&
          (!moneyAccount || t.accountId === moneyAccount || t.toAccountId === moneyAccount) &&
          matchesQuery(t, query, data.categoryById, data.accountById),
      ),
    [data.transactions, data.categoryById, data.accountById, month, moneyAccount, query, searching],
  );
  const monthTxs = useMemo(
    () =>
      data.transactions.filter(
        (t) => monthOf(t.date) === month && (!moneyAccount || t.accountId === moneyAccount || t.toAccountId === moneyAccount),
      ),
    [data.transactions, month, moneyAccount],
  );
  const totals = monthTotals(monthTxs, data.accountById, data.rates);
  const savings = useMemo(() => {
    const jars = activeJars(data.accounts);
    return { count: jars.length, ...savingsTotals(jars, data.balances, data.rateFor) };
  }, [data.accounts, data.balances, data.rateFor]);
  const debtTotals = useMemo(() => {
    const o = debtsOverview(data.debts, data.transactions, today);
    return { owed: totalKgs(o.totals.owedToMe, data.rateFor), mine: totalKgs(o.totals.iOwe, data.rateFor) };
  }, [data.debts, data.transactions, data.rateFor, today]);
  const groups = useMemo(() => groupByDay(filtered, data.accountById, data.rates), [filtered, data.accountById, data.rates]);
  const items = useMemo(() => {
    const list: ListItem[] = [];
    for (const g of groups) {
      list.push({ kind: 'day', group: g });
      g.items.forEach((tx, i) => list.push({ kind: 'tx', tx, first: i === 0, last: i === g.items.length - 1 }));
    }
    return list;
  }, [groups]);

  const remove = async (tx: Transaction) => {
    const deleted = await deleteTransaction(tx.id);
    if (deleted) toast({ message: 'Запись удалена', actionLabel: 'Отменить', onAction: () => void restoreTransaction(deleted) });
  };

  return (
    <>
      <header className="pt-safe px-4">
        <div className="flex items-end justify-between gap-3 pt-4 pb-3">
          <h1 className="text-h1 font-bold">Деньги</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={searchOpen ? 'Скрыть поиск' : 'Поиск по операциям'}
              aria-pressed={searchOpen}
              onClick={() => {
                if (searchOpen) setQuery('');
                setSearchOpen(!searchOpen);
              }}
              className={`flex size-11 items-center justify-center rounded-ctl ring-1 ring-line ${searchOpen ? 'bg-primary text-white' : 'bg-surface text-accent'}`}
            >
              {searchOpen ? <X size={20} aria-hidden /> : <Search size={20} aria-hidden />}
            </button>
            <button
              type="button"
              onClick={() => push({ name: 'recurring' })}
              className="flex min-h-11 items-center gap-1.5 rounded-ctl bg-surface px-3 font-medium text-accent ring-1 ring-line"
            >
              <Repeat size={16} aria-hidden />
              Регулярные
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4">
        {/* Переключатель месяца — такой же, как в отчётах, а не подпись над заголовком. */}
        <div className="flex items-center justify-between rounded-card bg-surface px-1">
          <button type="button" aria-label="Предыдущий месяц" onClick={() => setMonth(addMonths(month, -1))} className="flex size-11 items-center justify-center text-muted">
            <ChevronLeft size={20} aria-hidden />
          </button>
          <span className="font-semibold">{formatMonthKey(month)}</span>
          <button
            type="button"
            aria-label="Следующий месяц"
            disabled={month >= lastMonth}
            onClick={() => setMonth(addMonths(month, 1))}
            className="flex size-11 items-center justify-center text-muted disabled:opacity-30"
          >
            <ChevronRight size={20} aria-hidden />
          </button>
        </div>

        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-card bg-line" aria-label="Итоги месяца">
          <button type="button" onClick={() => showReports('money', month)} className="bg-surface p-4 text-left active:bg-bg">
            <p className="text-caption text-muted">Доходы</p>
            <p className={`tabular text-h2 font-semibold ${totals.income ? 'text-income' : 'text-muted'}`}>
              {totals.income ? '+' : ''}
              {formatMoney(totals.income, BASE_CURRENCY)}
            </p>
          </button>
          <button type="button" onClick={() => showReports('money', month)} className="bg-surface p-4 text-left active:bg-bg">
            <p className="text-caption text-muted">Расходы</p>
            <p className={`tabular text-h2 font-semibold ${totals.expense ? '' : 'text-muted'}`}>
              {totals.expense ? '−' : ''}
              {formatMoney(totals.expense, BASE_CURRENCY)}
            </p>
          </button>
          {totals.foreign.map((f) => (
            <div key={f.currency} className="col-span-2 bg-surface px-4 py-3 text-caption text-muted">
              {currencyLabel(f.currency)}:{' '}
              {f.income > 0 && (
                <span className="tabular text-income">
                  +{formatAmount(f.income)} ≈ {formatMoney(f.incomeKgs, BASE_CURRENCY)}
                </span>
              )}
              {f.income > 0 && f.expense > 0 && ' · '}
              {f.expense > 0 && (
                <span className="tabular text-ink">
                  {'\u2212'}
                  {formatAmount(f.expense)} ≈ {formatMoney(f.expenseKgs, BASE_CURRENCY)}
                </span>
              )}
            </div>
          ))}
        </section>

        {/* Копилка и долги — две плитки в одну строку: история начинается выше. */}
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-card bg-line" aria-label="Копилка и долги">
          <button type="button" onClick={() => push({ name: 'savings', back: 'Деньги' })} className="flex items-center gap-2.5 bg-surface p-3 text-left active:bg-bg">
            <IconCircle name="PiggyBank" color="#BE185D" size={32} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Копилка</span>
              <span className="tabular block truncate text-caption text-muted">
                {savings.count ? `${savings.approx ? '≈ ' : ''}${formatMoney(savings.kgs, BASE_CURRENCY)}` : 'Завести'}
              </span>
            </span>
          </button>
          <button type="button" onClick={() => push({ name: 'debts', back: 'Деньги' })} className="flex items-center gap-2.5 bg-surface p-3 text-left active:bg-bg">
            <IconCircle name="HandCoins" color="#B45309" size={32} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Долги</span>
              {debtTotals.owed || debtTotals.mine ? (
                <span className="tabular block text-caption leading-tight text-muted">
                  <span className="block">мне {formatMoney(debtTotals.owed, BASE_CURRENCY)}</span>
                  <span className="block">я {formatMoney(debtTotals.mine, BASE_CURRENCY)}</span>
                </span>
              ) : (
                <span className="block text-caption text-muted">Записать</span>
              )}
            </span>
          </button>
        </section>

        {searchOpen && (
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Категория, комментарий, сумма"
              aria-label="Поиск по операциям"
              className="block min-h-11 w-full rounded-ctl bg-surface pr-3 pl-10 ring-1 ring-line outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        )}

        <div role="group" aria-label="Фильтр по счёту" className="flex flex-wrap gap-2">
          <Chip selected={!moneyAccount} onClick={() => showAccountHistory(null)}>
            Все
          </Chip>
          {activeAccounts.map((a) => (
            <Chip key={a.id} selected={moneyAccount === a.id} onClick={() => showAccountHistory(a.id)}>
              {a.name}
            </Chip>
          ))}
        </div>

        {searching && <p className="px-1 text-caption text-muted">Поиск по всем месяцам: найдено {filtered.length}</p>}

        {items.length === 0 ? (
          <div className="rounded-card bg-surface p-6 text-center text-muted">
            {searching ? 'Ничего не нашлось' : 'В этом месяце записей нет. Нажмите «+», чтобы добавить.'}
          </div>
        ) : (
          <VirtualList
            items={items}
            getKey={(i) => (i.kind === 'day' ? `d${i.group.date}` : i.tx.id)}
            height={(i) => (i.kind === 'day' ? 44 : 64)}
            render={(i) =>
              i.kind === 'day' ? (
                // Заголовок дня — итог этого дня: операции, дела, привычки (этап 18).
                <button
                  type="button"
                  onClick={() => push({ name: 'day', date: i.group.date })}
                  aria-label={`${formatDayTitle(i.group.date, today)}. Итог дня`}
                  className="flex h-11 w-full items-end justify-between rounded-ctl px-1 pb-1.5 text-left active:bg-line"
                >
                  <h2 className="flex items-center gap-0.5 text-caption font-semibold text-muted">
                    {formatDayTitle(i.group.date, today)}
                    <ChevronRight size={14} aria-hidden />
                  </h2>
                  <span className={`tabular text-caption font-medium ${i.group.total > 0 ? 'text-income' : 'text-muted'}`}>
                    {i.group.approx ? '≈ ' : ''}
                    {i.group.total > 0 ? '+' : ''}
                    {formatAmount(i.group.total)}
                  </span>
                </button>
              ) : (
                <div className={`relative overflow-hidden bg-surface ${i.last ? 'rounded-b-card' : ''} ${i.first ? 'rounded-t-card' : ''}`}>
                  <SwipeRow onDelete={() => void remove(i.tx)}>
                    <TransactionRow tx={i.tx} onClick={() => setEditing(i.tx)} />
                  </SwipeRow>
                  {!i.last && <div className="pointer-events-none absolute right-0 bottom-0 left-16 h-px bg-line" />}
                </div>
              )
            }
          />
        )}
      </div>
      {editing && <TransactionEditor tx={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
