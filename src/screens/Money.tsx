import { ChevronLeft, ChevronRight, Repeat, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNav, useToday } from '../app/nav';
import { deleteTransaction, restoreTransaction } from '../data/actions';
import { useData } from '../data/DataProvider';
import { addMonths, formatDayTitle, formatMonthKey, monthOf } from '../domain/date';
import { groupByDay, matchesQuery, monthTotals, type DayGroup } from '../domain/history';
import { currencyLabel, formatAmount, formatMoney } from '../domain/money';
import type { Transaction } from '../domain/types';
import { Chip } from '../ui/controls';
import { SwipeRow } from '../ui/SwipeRow';
import { useToast } from '../ui/Toast';
import { TransactionRow } from '../ui/TransactionRow';
import { VirtualList } from '../ui/VirtualList';
import { TransactionEditor } from './entry/TransactionEditor';

type ListItem = { kind: 'day'; group: DayGroup } | { kind: 'tx'; tx: Transaction; first: boolean; last: boolean };

export function Money() {
  const data = useData();
  const today = useToday();
  const { moneyAccount, showAccountHistory, push } = useNav();
  const toast = useToast();
  const [month, setMonth] = useState(monthOf(today));
  const [query, setQuery] = useState('');
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
          <div>
            <div className="-ml-3 flex items-center">
              <button type="button" aria-label="Предыдущий месяц" onClick={() => setMonth(addMonths(month, -1))} className="flex size-11 items-center justify-center text-muted">
                <ChevronLeft size={20} aria-hidden />
              </button>
              <span className="min-w-[110px] text-center text-caption font-medium text-muted">{formatMonthKey(month)}</span>
              <button
                type="button"
                aria-label="Следующий месяц"
                disabled={month >= monthOf(today)}
                onClick={() => setMonth(addMonths(month, 1))}
                className="flex size-11 items-center justify-center text-muted disabled:opacity-30"
              >
                <ChevronRight size={20} aria-hidden />
              </button>
            </div>
            <h1 className="text-h1 font-bold">Деньги</h1>
          </div>
<button
            type="button"
            onClick={() => push({ name: 'recurring' })}
            className="flex min-h-11 items-center gap-1.5 rounded-ctl bg-surface px-3 font-medium text-accent ring-1 ring-line"
          >
            <Repeat size={16} aria-hidden />
            Регулярные
          </button>
        </div>
      </header>

      <div className="space-y-4 px-4">
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-card bg-line" aria-label="Итоги месяца">
          <div className="bg-surface p-4">
            <p className="text-caption text-muted">Доходы</p>
            <p className="tabular text-h2 font-semibold text-income">+{formatMoney(totals.income, 'KGS')}</p>
          </div>
          <div className="bg-surface p-4">
            <p className="text-caption text-muted">Расходы</p>
            <p className="tabular text-h2 font-semibold">{'−'}{formatMoney(totals.expense, 'KGS')}</p>
          </div>
          {totals.foreign.map((f) => (
            <div key={f.currency} className="col-span-2 bg-surface px-4 py-3 text-caption text-muted">
              {currencyLabel(f.currency)}:{' '}
              {f.income > 0 && (
                <span className="tabular text-income">
                  +{formatAmount(f.income)} ≈ {formatMoney(f.incomeKgs, 'KGS')}
                </span>
              )}
              {f.income > 0 && f.expense > 0 && ' · '}
              {f.expense > 0 && (
                <span className="tabular text-ink">
                  {'\u2212'}
                  {formatAmount(f.expense)} ≈ {formatMoney(f.expenseKgs, 'KGS')}
                </span>
              )}
            </div>
          ))}
        </section>

        <div className="relative">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Категория, комментарий, сумма"
            aria-label="Поиск по операциям"
            className="block min-h-11 w-full rounded-ctl bg-surface pr-3 pl-10 ring-1 ring-line outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

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
                <div className="flex h-11 items-end justify-between px-1 pb-1.5">
                  <h2 className="text-caption font-semibold text-muted">{formatDayTitle(i.group.date, today)}</h2>
                  <span className={`tabular text-caption font-medium ${i.group.total > 0 ? 'text-income' : 'text-muted'}`}>
                    {i.group.approx ? '≈ ' : ''}
                    {i.group.total > 0 ? '+' : ''}
                    {formatAmount(i.group.total)}
                  </span>
                </div>
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
