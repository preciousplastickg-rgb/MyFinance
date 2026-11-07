import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNav, useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { addMonths, formatMonthKey, monthOf } from '../../domain/date';
import { latestMonth, txInKgs } from '../../domain/history';
import { BASE_CURRENCY } from '../../domain/currency';
import { formatAmount, formatMoney } from '../../domain/money';
import { accountFlows, monthReport, monthSummary, paceSeries, type CategoryStat, type Insight } from '../../domain/reports';
import { CountUp, Donut } from '../../ui/charts';
import { IconCircle } from '../../ui/icons';
import type { Transaction } from '../../domain/types';
import { CategoryDetail } from './CategoryDetail';
import { TxListSheet } from './TxListSheet';
import { AccountsCard, PaceCard, SummaryCard } from './MoneyV2';
import { asStat, LimitRows, useCategoryLimits } from '../money/LimitsBlock';
import { limitsSummary } from '../../domain/limits';
import { colorCss } from '../../domain/catalog';

function Card({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="card space-y-2.5 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  const warn = delta >= 20;
  return (
    <span className={`tabular text-caption font-semibold ${warn ? 'text-warn' : 'text-muted'}`}>
      {delta > 0 ? '+' : '−'}
      {Math.abs(delta)}%
    </span>
  );
}

export function MoneyReport() {
  const data = useData();
  const today = useToday();
  const { push, reportsMonth, setReportsMonth } = useNav();
  // Месяц в nav: «Деньги» открывают отчёт за свой месяц, а переход в «Подписки» и назад его не сбрасывает.
  const month = reportsMonth ?? monthOf(today);
  const setMonth = setReportsMonth;
  const lastMonth = useMemo(() => latestMonth(data.transactions, today), [data.transactions, today]);
  const [detail, setDetail] = useState<CategoryStat | null>(null);
  const limits = useCategoryLimits(month, today);
  const [picked, setPicked] = useState<{ key: string; name: string; color: string; total: number } | null>(null);
  useEffect(() => setPicked(null), [month]);
  // Тап вне диаграммы возвращает её в исходное состояние (выбор пользователя).
  const donutBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!picked) return;
    const onDown = (e: PointerEvent) => {
      if (!donutBox.current?.contains(e.target as Node)) setPicked(null);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [picked]);
  // Тап по «Обязательные / Переменные» или по источнику дохода — его операции (этап 18).
  const [txList, setTxList] = useState<{ title: string; subtitle?: string; transactions: Transaction[] } | null>(null);
  const monthExpenses = (fixed: boolean) =>
    data.transactions.filter(
      (t) => t.type === 'expense' && monthOf(t.date) === month && !!data.categoryById.get(t.categoryId ?? '')?.isFixed === fixed,
    );

  const report = useMemo(
    () =>
      monthReport({
        month,
        today,
        transactions: data.transactions,
        accountById: data.accountById,
        categoryById: data.categoryById,
        recurring: data.recurring,
        rates: data.rates,
        settings: data.settings,
      }),
    // По полям, а не по data целиком: отметка привычки или дела не пересчитывает отчёт.
    [month, today, data.transactions, data.accountById, data.categoryById, data.recurring, data.rates, data.settings],
  );

  // Этап 22: итог месяца, темп и движение по счетам — те же операции, что у отчёта.
  const summary = useMemo(
    () => monthSummary(report, { transactions: data.transactions, accountById: data.accountById, rates: data.rates }),
    [report, data.transactions, data.accountById, data.rates],
  );
  const pace = useMemo(
    () => paceSeries({ month, today, transactions: data.transactions, accountById: data.accountById, rates: data.rates }),
    [month, today, data.transactions, data.accountById, data.rates],
  );
  const flows = useMemo(
    () =>
      accountFlows({
        month, today, accounts: data.accounts, transactions: data.transactions, accountById: data.accountById, categoryById: data.categoryById, recurring: data.recurring,
      }),
    [month, today, data.accounts, data.transactions, data.accountById, data.categoryById, data.recurring],
  );
  const byIds = (ids: readonly string[]) => {
    const set = new Set(ids);
    return data.transactions.filter((t) => set.has(t.id));
  };

  const pct = (v: number) => (report.totalExpense ? Math.round((v * 100) / report.totalExpense) : 0);
  const openInsight = (i: Insight) => {
    if (i.kind === 'subscriptions') push({ name: 'subscriptions' });
    else if (i.kind === 'small') {
      // У карточки нет категории — открываем сами мелкие траты месяца, по тому же правилу, что считал отчёт (меньше порога в сомах).
      const threshold = data.settings.smallExpenseThreshold;
      setTxList({
        title: 'Мелкие траты',
        subtitle: `${formatMonthKey(month)} · меньше ${formatMoney(threshold, BASE_CURRENCY)}`,
        transactions: data.transactions.filter(
          (t) => t.type === 'expense' && monthOf(t.date) === month && txInKgs(t, data.accountById.get(t.accountId)?.currency ?? BASE_CURRENCY, data.rates).value < threshold,
        ),
      });
    } else if (i.categoryId) setDetail(report.byCategory.find((c) => c.category.id === i.categoryId) ?? null);
  };

  return (
    <div className="space-y-4">
      <div className="-mt-2 flex items-center justify-center gap-2">
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

      <SummaryCard
        month={month}
        s={summary}
        onExpenses={() =>
          setTxList({
            title: 'Расходы',
            subtitle: `${formatMonthKey(month)} · ${formatMoney(report.totalExpense, BASE_CURRENCY)}`,
            transactions: data.transactions.filter((t) => t.type === 'expense' && monthOf(t.date) === month),
          })
        }
        onIncomes={() =>
          setTxList({
            title: 'Доходы',
            subtitle: `${formatMonthKey(month)} · ${formatMoney(report.totalIncome, BASE_CURRENCY)}`,
            transactions: byIds(report.incomes.flatMap((i) => i.ids)),
          })
        }
      />

      <PaceCard month={month} p={pace} today={today} onDay={(date) => push({ name: 'day', date })} />

      <section className="card px-4 pt-5 pb-2" aria-label="Расходы по категориям">
        {report.totalExpense === 0 ? (
          <p className="pb-4 text-center text-[14px] text-muted">В этом месяце расходов нет</p>
        ) : (
          <>
            <div ref={donutBox}>
            <Donut
              segments={report.segments}
              animateKey={month}
              selected={picked?.key}
              onSelect={(key) => setPicked(key ? (report.segments.find((x) => x.key === key) ?? null) : null)}
              label={`Расходы за ${formatMonthKey(month)}: ${formatMoney(report.totalExpense, BASE_CURRENCY)}`}
            >
              {picked ? (
                // Выбран сектор: категория, сумма и доля; тап по центру — её детализация.
                <button
                  type="button"
                  onClick={() => {
                    const stat = report.byCategory.find((c) => c.category.id === picked.key);
                    if (stat) setDetail(stat);
                  }}
                  className="pointer-events-auto flex size-32 flex-col items-center justify-center rounded-full"
                  aria-label={`${picked.name}: ${formatMoney(picked.total, BASE_CURRENCY)}. Открыть`}
                >
                  <span className="max-w-28 truncate text-[12px] font-semibold" style={{ color: colorCss(picked.color) }}>
                    {picked.name}
                  </span>
                  <span className="display-num text-[22px]">{formatAmount(picked.total)}</span>
                  <span className="tabular text-[12px] text-muted">{Math.round((picked.total * 100) / report.totalExpense)}% расходов</span>
                </button>
              ) : (
                <>
                  <span className="text-[12px] text-muted">Расходы</span>
                  <span className="display-num text-[22px]">
                    {report.approx ? '≈ ' : ''}
                    <CountUp key={month} value={report.totalExpense} format={(v) => formatAmount(v === report.totalExpense ? v : Math.round(v / 100) * 100)} />
                  </span>
                  <span className="text-[12px] text-muted">сом за месяц</span>
                </>
              )}
            </Donut>
            </div>
            {report.comparisons && report.sameDay && (
              <p className="pt-2 text-center text-[12px] text-muted">% — к среднему за 1–{report.sameDay} число прошлых месяцев</p>
            )}
            <ul className="mt-3" aria-label="Легенда">
              {report.byCategory.map((s, i) => (
                <li key={s.category.id} className={i ? 'border-t border-line' : ''}>
                  <button type="button" onClick={() => setDetail(s)} className="flex min-h-12 w-full items-center gap-3 text-left">
                    <IconCircle name={s.category.icon} color={s.category.color} size={32} />
                    <span className="min-w-0 flex-1 truncate font-medium">{s.category.name}</span>
                    {s.delta !== undefined && <DeltaBadge delta={s.delta} />}
                    <span className="tabular min-w-16 shrink-0 text-right font-semibold">
                      {s.approx ? '≈ ' : ''}
                      {formatAmount(s.total)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {report.totalExpense > 0 && (
        <section className="card p-4" aria-label="Обязательные и переменные">
          <h2 className="mb-2.5 font-semibold">Обязательные и переменные</h2>
          <div className="flex h-2.5 gap-[3px]" role="img" aria-label={`Обязательные ${pct(report.fixed)}%, переменные ${pct(report.variable)}%`}>
            <span className="rounded-[5px] bg-primary" style={{ width: `${pct(report.fixed)}%` }} />
            <span className="flex-1 rounded-[5px] bg-sunk" />
          </div>
          <div className="tabular mt-2 flex justify-between gap-2 text-[12px] whitespace-nowrap">
            <button
              type="button"
              onClick={() => setTxList({ title: 'Обязательные', subtitle: `${formatMonthKey(month)} · ${formatMoney(report.fixed, BASE_CURRENCY)}`, transactions: monthExpenses(true) })}
              className="min-h-11 text-left"
            >
              Обязательные <b>{formatAmount(report.fixed)}</b> · {pct(report.fixed)}%
            </button>
            <button
              type="button"
              onClick={() => setTxList({ title: 'Переменные', subtitle: `${formatMonthKey(month)} · ${formatMoney(report.variable, BASE_CURRENCY)}`, transactions: monthExpenses(false) })}
              className="min-h-11 text-right text-muted"
            >
              Переменные <b className="text-ink">{formatAmount(report.variable)}</b> · {pct(report.variable)}%
            </button>
          </div>
        </section>
      )}

      {limits.length > 0 && (
        <section className="space-y-2" aria-label="Лимиты по категориям">
          <div className="flex items-end justify-between px-1">
            <h2 className="text-h2 font-semibold">Лимиты</h2>
            <span className={`tabular text-caption ${limitsSummary(limits).over ? 'text-warn' : 'text-muted'}`}>{limitsSummary(limits).text}</span>
          </div>
          <LimitRows views={limits} label="Лимиты по категориям" onPick={(v) => setDetail(report.byCategory.find((c) => c.category.id === v.category.id) ?? asStat(v))} />
        </section>
      )}

      <AccountsCard
        month={month}
        flows={flows.flows}
        to={flows.to}
        rateFor={data.rateFor}
        onLine={(title, subtitle, ids) => setTxList({ title, subtitle, transactions: byIds(ids) })}
      />

      <Card
        title="Доходы"
        right={
          <span className={`tabular font-semibold ${report.totalIncome ? 'text-income' : 'text-muted'}`}>
            {report.incomes.some((i) => i.approx) ? '≈ ' : ''}
            {report.totalIncome ? '+' : ''}
            {formatMoney(report.totalIncome, BASE_CURRENCY)}
          </span>
        }
      >
        {report.incomes.length === 0 ? (
          <p className="text-[14px] text-muted">В этом месяце доходов нет</p>
        ) : (
          <ul className="-mx-2">
            {report.incomes.map((i) => (
              <li key={i.name}>
                <button
                  type="button"
                  onClick={() => {
                    const ids = new Set(i.ids);
                    setTxList({ title: i.name, subtitle: formatMonthKey(month), transactions: data.transactions.filter((t) => ids.has(t.id)) });
                  }}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-ctl px-2 text-left active:bg-bg"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{i.name}</span>
                    {i.noRate.length > 0 && (
                      <span className="block text-caption text-warn">
                        {i.noRate.map((n) => formatMoney(n.amount, n.currency)).join(' · ')} — нет курса, в итог не вошло
                      </span>
                    )}
                  </span>
                  <span className="tabular shrink-0">
                    {i.approx ? '≈ ' : ''}
                    {formatMoney(i.total, BASE_CURRENCY)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {report.insights.length > 0 && (
        <section className="space-y-3">
          <h2 className="px-1 pt-2 text-h2 font-semibold">Где можно сократить</h2>
          {report.insights.map((i) => {
            const cat = i.categoryId ? data.categoryById.get(i.categoryId) : undefined;
            const icon = cat?.icon ?? (i.kind === 'subscriptions' ? 'Repeat' : 'Coins');
            const color = cat?.color ?? (i.kind === 'subscriptions' ? 'violet' : 'slate');
            return (
              <button key={i.kind + i.title} type="button" onClick={() => openInsight(i)} className="card flex w-full gap-3 px-4 py-3.5 text-left active:opacity-80">
                <IconCircle name={icon} color={color} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2">
                    <span className="font-semibold">{i.title}</span>
                    <span className="tabular shrink-0 text-caption font-semibold whitespace-nowrap text-accent">{i.gain}</span>
                  </span>
                  <span className="tabular block text-caption text-pretty text-muted">{i.text}</span>
                </span>
              </button>
            );
          })}
        </section>
      )}

      {detail && <CategoryDetail stat={detail} month={month} onClose={() => setDetail(null)} />}
      {txList && <TxListSheet {...txList} onClose={() => setTxList(null)} />}
    </div>
  );
}
