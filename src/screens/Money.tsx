import { ChevronLeft, ChevronRight, HandCoins, PiggyBank, Repeat, Search, X } from '../ui/glyphs';
import { useMemo, useState } from 'react';
import { useNav, useToday } from '../app/nav';
import { deleteTransaction, restoreTransaction } from '../data/actions';
import { useData } from '../data/DataProvider';
import { totalInKgs } from '../domain/balance';
import { BASE_CURRENCY } from '../domain/currency';
import { addMonths, formatDayTitle, formatMonthKey, monthOf } from '../domain/date';
import { debtsOverview, totalKgs } from '../domain/debts';
import { loansOverview } from '../domain/loans';
import { activeJars, savingsTotals } from '../domain/savings';
import { groupByDay, latestMonth, matchesQuery, monthTotals, type DayGroup } from '../domain/history';
import { currencyLabel, formatAmount, formatMoney, roundToSom } from '../domain/money';
import type { Transaction } from '../domain/types';
import { AccountsStrip } from '../ui/AccountsStrip';
import { Chip } from '../ui/controls';
import { SwipeRow } from '../ui/SwipeRow';
import { useToast } from '../ui/Toast';
import { TransactionRow } from '../ui/TransactionRow';
import { VirtualList } from '../ui/VirtualList';
import { HideAmountsButton, useAmountsHidden, useMask } from '../ui/Secret';
import { TransactionEditor } from './entry/TransactionEditor';
import { LimitsBlock } from './money/LimitsBlock';

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

  const filterAccount = moneyAccount ? data.accountById.get(moneyAccount) : undefined;
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
  const totals = useMemo(() => monthTotals(monthTxs, data.accountById, data.rates), [monthTxs, data.accountById, data.rates]);
  // Сколько денег всего — все активные счета, с копилками, валюта по курсу (этап 25; как в карточке «Остаток» на «Сегодня»).
  const balanceTotal = useMemo(() => totalInKgs(data.accounts, data.balances, data.rateFor), [data.accounts, data.balances, data.rateFor]);
  // Кредиты в карточке итогов (по просьбе пользователя): сколько осталось выплатить, тап — список кредитов.
  const loans = useMemo(() => loansOverview(data.recurring, data.occurrenceLog, data.rateFor), [data.recurring, data.occurrenceLog, data.rateFor]);
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

  const foundExpense = useMemo(() => filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [filtered]);

  // Плитки итогов: до целого сома (копейки от валютных платежей не читаются), а длинная сумма — шрифтом меньше,
  // иначе Unbounded 19 px вылезал за край карточки («−103 822,61 сом» на iPhone 13).
  const incomeText = formatMoney(roundToSom(totals.income), BASE_CURRENCY);
  const expenseText = formatMoney(roundToSom(totals.expense), BASE_CURRENCY);
  const tileSize = Math.max(incomeText.length, expenseText.length) > 12 ? 'text-num-s' : 'text-num-m';

  // «Скрыть суммы» (по просьбе пользователя): итоги, кредиты, копилка и долги — «••••»; записи истории видны.
  const hidden = useAmountsHidden();
  const m = useMask();

  const remove = async (tx: Transaction) => {
    const deleted = await deleteTransaction(tx.id);
    if (deleted) toast({ message: 'Запись удалена', actionLabel: 'Отменить', onAction: () => void restoreTransaction(deleted) });
  };

  return (
    <>
      <header className="pt-safe pr-3 pl-5">
        <div className="flex items-center justify-between gap-1 pt-1 pb-1.5">
          <h1 className="text-h1 font-semibold">Деньги</h1>
          <div className="flex items-center gap-1">
            <HideAmountsButton className="" />
            <button
              type="button"
              aria-label={searchOpen ? 'Скрыть поиск' : 'Поиск по операциям'}
              aria-pressed={searchOpen}
              onClick={() => {
                if (searchOpen) setQuery('');
                setSearchOpen(!searchOpen);
              }}
              className={`flex size-11 items-center justify-center rounded-ctl ${searchOpen ? 'bg-sunk' : ''}`}
            >
              {searchOpen ? <X size={22} strokeWidth={1.9} aria-hidden /> : <Search size={22} strokeWidth={1.9} aria-hidden />}
            </button>
            <button
              type="button"
              onClick={() => push({ name: 'recurring' })}
              className="flex min-h-10 items-center gap-1.5 rounded-ctl px-3 text-sub font-semibold ring-[1.5px] ring-line ring-inset"
            >
              <Repeat size={15} aria-hidden />
              Регулярные
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4">
        {searchOpen && (
          <div>
            <div className="flex min-h-12 items-center gap-2.5 rounded-ctl bg-surface pr-1.5 pl-3.5 shadow-card">
              <Search size={17} className="shrink-0 text-muted" aria-hidden />
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Категория, комментарий или сумма"
                aria-label="Поиск по операциям"
                className="h-11 min-w-0 flex-1 bg-transparent text-input outline-none"
              />
              {query && (
                <button type="button" aria-label="Очистить" onClick={() => setQuery('')} className="flex size-9 items-center justify-center text-muted">
                  <X size={16} aria-hidden />
                </button>
              )}
            </div>
            {searching && (
              <p className="tabular px-1 pt-2 text-caption text-muted">
                {filtered.length ? `Найдено ${filtered.length} · расходы ${formatMoney(foundExpense, BASE_CURRENCY)}` : 'Ничего не нашлось'}
              </p>
            )}
          </div>
        )}

        {!searching && (
          <div className="flex items-center justify-center gap-2 pb-1">
            <button type="button" aria-label="Предыдущий месяц" onClick={() => setMonth(addMonths(month, -1))} className="flex size-11 items-center justify-center text-muted">
              <ChevronLeft size={20} aria-hidden />
            </button>
            <span className="min-w-[140px] text-center font-semibold">{formatMonthKey(month)}</span>
            <button
              type="button"
              aria-label="Следующий месяц"
              disabled={month >= lastMonth}
              onClick={() => setMonth(addMonths(month, 1))}
              className="flex size-11 items-center justify-center text-muted disabled:text-line"
            >
              <ChevronRight size={20} aria-hidden />
            </button>
          </div>
        )}

        {!searching && (
        <section className="card grid grid-cols-2 p-4" aria-label="Итоги месяца">
          <div className="col-span-2 mb-3 flex items-baseline justify-between gap-3 border-b border-line pb-3">
            <span className="text-caption text-muted">Остаток на счетах</span>
            <span className={`display-num min-w-0 truncate text-num-l ${balanceTotal.total < 0 && !hidden ? 'text-warn' : ''}`}>
              {balanceTotal.approx && !hidden ? '≈ ' : ''}
              {m(formatMoney(balanceTotal.total, BASE_CURRENCY))}
            </span>
          </div>
          <button type="button" onClick={() => showReports('money', month)} className="min-w-0 text-left">
            <p className="text-caption text-muted">Доходы</p>
            <p className={`display-num ${tileSize} ${totals.income ? 'text-income' : 'text-muted'}`}>
              {m(`${totals.income ? '+' : ''}${incomeText}`)}
            </p>
          </button>
          <button type="button" onClick={() => showReports('money', month)} className="min-w-0 border-l border-line pl-4 text-left">
            <p className="text-caption text-muted">Расходы</p>
            <p className={`display-num ${tileSize} ${totals.expense ? '' : 'text-muted'}`}>
              {m(`${totals.expense ? '−' : ''}${expenseText}`)}
            </p>
          </button>
          {totals.foreign.map((f) => (
            <div key={f.currency} className="col-span-2 pt-3 text-caption text-muted">
              {currencyLabel(f.currency)}:{' '}
              {f.income > 0 && (
                <span className="tabular text-income">
                  {m(`+${formatAmount(f.income)} ≈ ${formatMoney(f.incomeKgs, BASE_CURRENCY)}`)}
                </span>
              )}
              {f.income > 0 && f.expense > 0 && ' · '}
              {f.expense > 0 && (
                <span className="tabular text-ink">
                  {m(`\u2212${formatAmount(f.expense)} ≈ ${formatMoney(f.expenseKgs, BASE_CURRENCY)}`)}
                </span>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => push({ name: 'loans', back: 'Деньги' })}
            className="col-span-2 mt-3 flex min-h-11 items-center justify-between gap-3 border-t border-line pt-3 text-left"
          >
            <span className="text-caption text-muted">Кредиты{loans.count > 1 ? ` · ${loans.count}` : ''}</span>
            <span className="flex min-w-0 items-center gap-1">
              {loans.count ? (
                <span className="display-num min-w-0 truncate text-num-m">
                  {m(`${loans.approx ? '≈ ' : ''}\u2212${formatMoney(loans.left, BASE_CURRENCY)}`)}
                </span>
              ) : (
                <span className={`text-body font-semibold ${loans.any ? 'text-muted' : 'text-accent'}`}>{loans.any ? 'выплачены' : 'Добавить'}</span>
              )}
              <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
            </span>
          </button>
        </section>
        )}

        {/* Копилка и долги — две плитки в одну строку: история начинается выше. */}
        {!searching && (
        <section className="grid grid-cols-2 gap-2.5" aria-label="Копилка и долги">
          <button type="button" onClick={() => push({ name: 'savings', back: 'Деньги' })} className="card rounded-[20px] px-3.5 py-3 text-left active:bg-sunk">
            <span className="flex items-center gap-1.5 text-caption text-muted">
              <PiggyBank size={15} aria-hidden />
              Копилка
            </span>
            <span className="tabular mt-0.5 block truncate font-semibold">
              {savings.count ? m(`${savings.approx ? '≈ ' : ''}${formatMoney(savings.kgs, BASE_CURRENCY)}`) : 'Завести'}
            </span>
          </button>
          <button type="button" onClick={() => push({ name: 'debts', back: 'Деньги' })} className="card rounded-[20px] px-3.5 py-3 text-left active:bg-sunk">
            <span className="flex items-center gap-1.5 text-caption text-muted">
              <HandCoins size={15} aria-hidden />
              Долги
            </span>
            <span className="tabular mt-0.5 block truncate font-semibold">
              {(debtTotals.owed || debtTotals.mine) && hidden ? (
                m('')
              ) : debtTotals.owed || debtTotals.mine ? (
                <span aria-label={`мне ${formatAmount(debtTotals.owed)} · я ${formatAmount(debtTotals.mine)}`}>
                  <span className="text-income">+{formatAmount(debtTotals.owed)}</span>
                  <span className="text-muted"> · </span>
                  <span className="text-warn">−{formatAmount(debtTotals.mine)}</span>
                </span>
              ) : 'Записать'}
            </span>
          </button>
        </section>
        )}

        {/* Счета с остатками — по просьбе пользователя; тап по счёту фильтрует историю. */}
        {!searching && <AccountsStrip storageKey="money-accounts-open" initialOpen back="Деньги" />}

        {/* Лимиты по категориям за выбранный месяц (этап 23); без лимитов блока нет. */}
        {!searching && <LimitsBlock month={month} today={today} />}

        {/* Чипы «Все · Наличные · MBank…» убраны по просьбе пользователя (2026-11-08): дублировали «Счета». Историю по счёту
            включает «Вся история ›» на экране счёта — пока фильтр включён, он виден одним чипом, крестик его снимает. */}
        {!searching && filterAccount && (
        <div role="group" aria-label="Фильтр по счёту" className="flex">
          <Chip selected onClick={() => showAccountHistory(null)} aria-label={`${filterAccount.name}. Показать все счета`}>
            {filterAccount.name}
            <X size={14} aria-hidden />
          </Chip>
        </div>
        )}

        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sub text-muted">
            {searching ? 'Ничего не нашлось' : 'В этом месяце записей нет. Нажмите «+», чтобы добавить.'}
          </div>
        ) : (
          <VirtualList
            items={items}
            getKey={(i) => (i.kind === 'day' ? `d${i.group.date}` : i.tx.id)}
            height={(i) => (i.kind === 'day' ? 44 : 56)}
            render={(i) =>
              i.kind === 'day' ? (
                // Заголовок дня — итог этого дня: операции, дела, привычки (этап 18).
                <button
                  type="button"
                  onClick={() => push({ name: 'day', date: i.group.date })}
                  aria-label={`${formatDayTitle(i.group.date, today)}. Итог дня`}
                  className="flex h-11 w-full items-end justify-between px-1 pb-1.5 text-left"
                >
                  <h2 className="text-caption font-semibold text-muted">{formatDayTitle(i.group.date, today)}</h2>
                  <span className={`tabular text-caption font-semibold ${i.group.total > 0 ? 'text-income' : 'text-muted'}`}>
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
