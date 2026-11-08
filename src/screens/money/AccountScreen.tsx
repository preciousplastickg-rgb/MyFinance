import { ChevronLeft, ChevronRight } from '../../ui/glyphs';
import { useMemo, useState } from 'react';
import { useNav, useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { BASE_CURRENCY, isBase } from '../../domain/currency';
import { addMonths, formatMonthKey, formatShortDate, monthOf } from '../../domain/date';
import { latestMonth } from '../../domain/history';
import { currencyLabel, formatAmount, formatMoney } from '../../domain/money';
import { toKgs } from '../../domain/rate';
import { accountFlows, type FlowLine } from '../../domain/reports';
import type { Id, Transaction } from '../../domain/types';
import { IconCircle } from '../../ui/icons';
import { SubScreen } from '../../ui/SubScreen';
import { TransactionEditor } from '../entry/TransactionEditor';
import { TxList, TxListSheet } from '../reports/TxListSheet';

const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatAmount(Math.abs(v))}`;

/**
 * Экран счёта (этап 25) — по тапу на счёт на «Сегодня»: остаток, за месяц «Пришло / Ушло» с разбивкой
 * (зарплата, расходы, переводы, долги — как в «По счетам» отчёта) и операции по счёту за месяц.
 */
export function AccountScreen({ id, back = 'Сегодня' }: { id: Id; back?: string }) {
  const data = useData();
  const today = useToday();
  const { showAccountHistory } = useNav();
  const [month, setMonth] = useState(() => monthOf(today));
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [txList, setTxList] = useState<{ title: string; subtitle: string; transactions: Transaction[] } | null>(null);
  const account = data.accountById.get(id);
  const lastMonth = useMemo(() => latestMonth(data.transactions, today), [data.transactions, today]);

  const flow = useMemo(() => {
    if (!account) return undefined;
    const r = accountFlows({
      month, today, accounts: [account], transactions: data.transactions, accountById: data.accountById, categoryById: data.categoryById, recurring: data.recurring,
    });
    return { ...r, flow: r.flows[0] };
  }, [account, month, today, data.transactions, data.accountById, data.categoryById, data.recurring]);

  const monthTxs = useMemo(
    () =>
      data.transactions
        .filter((t) => monthOf(t.date) === month && (t.accountId === id || t.toAccountId === id))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)),
    [data.transactions, month, id],
  );

  if (!account) return <SubScreen title="Счёт" back={back}><p className="text-muted">Счёт не найден.</p></SubScreen>;

  const balance = data.balances.get(id) ?? 0;
  const fx = !isBase(account.currency);
  const rate = fx ? data.rateFor(account.currency) : undefined;
  const f = flow?.flow;
  const byId = new Map(data.transactions.map((t) => [t.id, t]));
  const openLine = (l: FlowLine) =>
    setTxList({
      title: `${account.name}: ${l.label}`,
      subtitle: `${formatShortDate(f!.startDate)} – ${formatShortDate(flow!.to)} · ${signed(l.amount)}`,
      transactions: l.ids.map((x) => byId.get(x)).filter((t): t is Transaction => !!t),
    });

  return (
    <SubScreen
      title={account.name}
      back={back}
      hero={
        <section className="px-5 pt-1 pb-3.5" aria-label="Остаток на счёте">
          <div className="flex items-center gap-3.5">
            <IconCircle name={account.icon} color={account.color} size={48} dashed={fx && !account.includeInDaily} />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-h1 font-semibold">{account.name}</h1>
              <p className="text-caption text-muted">{account.includeInDaily ? 'в лимите на день' : 'вне лимита на день'}</p>
            </div>
          </div>
          {/* Остаток крупно над «Пришло / Ушло» (этап 27, замечание с телефона); месяц ниже на него не влияет. */}
          <p className="mt-3.5 text-caption text-muted">Остаток</p>
          <p className={`display-num text-num-xl ${balance < 0 ? 'text-warn' : ''}`}>
            {formatAmount(balance)}
            <span className="font-sans text-h2 font-semibold text-muted"> {currencyLabel(account.currency)}</span>
          </p>
          {fx && <p className="tabular text-caption text-muted">{rate ? `≈ ${formatMoney(toKgs(balance, rate), BASE_CURRENCY)}` : 'курса нет'}</p>}
        </section>
      }
    >
      <div className="flex items-center justify-center gap-2">
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

      {/* Пришло / Ушло за месяц в валюте счёта; ниже — из чего сложилось, строка открывает операции. */}
      <section className="card p-4" aria-label="Движение по счёту">
        {f ? (
          <>
            <div className="grid grid-cols-2">
              <div className="min-w-0">
                <p className="text-caption text-muted">Пришло</p>
                <p className={`display-num truncate text-num-m ${f.inflow ? 'text-income' : 'text-muted'}`}>
                  {f.inflow ? '+' : ''}
                  {formatAmount(f.inflow)}
                  {fx && <span className="text-caption font-normal text-muted"> {currencyLabel(account.currency)}</span>}
                </p>
              </div>
              <div className="min-w-0 border-l border-line pl-4">
                <p className="text-caption text-muted">Ушло</p>
                <p className={`display-num truncate text-num-m ${f.outflow ? '' : 'text-muted'}`}>
                  {f.outflow ? '−' : ''}
                  {formatAmount(f.outflow)}
                  {fx && <span className="text-caption font-normal text-muted"> {currencyLabel(account.currency)}</span>}
                </p>
              </div>
            </div>
            <p className="tabular mt-2 text-meta text-muted">
              {formatAmount(f.start)} на {formatShortDate(f.startDate)} → {formatAmount(f.end)} на {formatShortDate(flow!.to)} ·{' '}
              <span className={f.end - f.start > 0 ? 'text-income' : f.end - f.start < 0 ? 'text-warn' : ''}>{signed(f.end - f.start)}</span>
            </p>
            <ul className="tabular mt-3 divide-y divide-line text-sub" aria-label="Из чего сложилось">
              {f.lines.map((l) => (
                <li key={l.key}>
                  <button type="button" onClick={() => openLine(l)} className="flex min-h-11 w-full items-center justify-between gap-2 text-left">
                    <span className="min-w-0 truncate text-muted">{l.label}</span>
                    <span className={`flex items-center gap-1 font-semibold ${l.amount > 0 ? 'text-income' : ''}`}>
                      {signed(l.amount)}
                      <ChevronRight size={14} className="text-muted" aria-hidden />
                    </span>
                  </button>
                </li>
              ))}
              {!f.lines.length && <li className="py-2 text-muted">Движения не было</li>}
            </ul>
          </>
        ) : (
          <p className="text-sub text-muted">За этот месяц данных нет.</p>
        )}
      </section>

      <section className="space-y-2" aria-label="Операции по счёту">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-h2 font-semibold">Операции</h2>
          <button type="button" onClick={() => showAccountHistory(id)} className="min-h-11 text-caption font-medium text-accent">
            Вся история ›
          </button>
        </div>
        {monthTxs.length ? <TxList list={monthTxs} today={today} onOpen={setEditing} /> : <p className="px-1 py-5 text-center text-sub text-muted">В этом месяце операций не было</p>}
      </section>

      {editing && <TransactionEditor tx={editing} onClose={() => setEditing(null)} />}
      {txList && <TxListSheet {...txList} onClose={() => setTxList(null)} />}
    </SubScreen>
  );
}
