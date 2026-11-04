import { ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useNav, useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { addMonths, formatMonthKey, monthOf } from '../../domain/date';
import { formatAmount, formatMoney } from '../../domain/money';
import { monthReport, type CategoryStat, type Insight } from '../../domain/reports';
import { Donut } from '../../ui/charts';
import { IconCircle } from '../../ui/icons';
import { CategoryDetail } from './CategoryDetail';

function Card({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-h2 font-semibold">{title}</h2>
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
  const { push } = useNav();
  const [month, setMonth] = useState(monthOf(today));
  const [detail, setDetail] = useState<CategoryStat | null>(null);

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
    [month, today, data],
  );

  const pct = (v: number) => (report.totalExpense ? Math.round((v * 100) / report.totalExpense) : 0);
  const openInsight = (i: Insight) => {
    if (i.kind === 'subscriptions') push({ name: 'subscriptions' });
    else if (i.categoryId) setDetail(report.byCategory.find((c) => c.category.id === i.categoryId) ?? null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl bg-surface px-1">
        <button type="button" aria-label="Предыдущий месяц" onClick={() => setMonth(addMonths(month, -1))} className="flex size-11 items-center justify-center text-muted">
          <ChevronLeft size={20} aria-hidden />
        </button>
        <span className="font-semibold">{formatMonthKey(month)}</span>
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

      <Card title="Расходы по категориям">
        {report.totalExpense === 0 ? (
          <p className="py-6 text-center text-muted">В этом месяце расходов нет</p>
        ) : (
          <>
            <Donut segments={report.segments} label={`Расходы за ${formatMonthKey(month)}: ${formatMoney(report.totalExpense, 'KGS')}`}>
              <span className="text-caption text-muted">Всего</span>
              <span className="tabular text-h2 font-bold">
                {report.approx ? '≈ ' : ''}
                {formatAmount(report.totalExpense)}
              </span>
              <span className="text-caption text-muted">сом</span>
            </Donut>
            {!report.comparisons && <p className="text-center text-caption text-muted">Сравнения появятся после месяца записей</p>}
            <ul className="-mx-4 divide-y divide-line" aria-label="Легенда">
              {report.byCategory.map((s) => (
                <li key={s.category.id}>
                  <button type="button" onClick={() => setDetail(s)} className="flex min-h-13 w-full items-center gap-3 px-4 py-2 text-left active:bg-bg">
                    <IconCircle name={s.category.icon} color={s.category.color} />
                    <span className="min-w-0 flex-1 truncate">{s.category.name}</span>
                    {s.delta !== undefined && <DeltaBadge delta={s.delta} />}
                    <span className="tabular w-24 shrink-0 text-right font-medium">
                      {s.approx ? '≈ ' : ''}
                      {formatAmount(s.total)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {report.totalExpense > 0 && (
        <Card title="Обязательные и переменные">
          <div className="flex h-3 overflow-hidden rounded-full bg-line" role="img" aria-label={`Обязательные ${pct(report.fixed)}%, переменные ${pct(report.variable)}%`}>
            <div className="bg-primary" style={{ width: `${pct(report.fixed)}%` }} />
            <div className="bg-accent/50" style={{ width: `${pct(report.variable)}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-caption text-muted">
                <span className="size-2.5 rounded-full bg-primary" aria-hidden /> Обязательные
              </p>
              <p className="tabular font-semibold">
                {formatMoney(report.fixed, 'KGS')} <span className="font-normal text-muted">· {pct(report.fixed)}%</span>
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-caption text-muted">
                <span className="size-2.5 rounded-full bg-accent/50" aria-hidden /> Переменные
              </p>
              <p className="tabular font-semibold">
                {formatMoney(report.variable, 'KGS')} <span className="font-normal text-muted">· {pct(report.variable)}%</span>
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card
        title="Доходы"
        right={
          <span className="tabular font-semibold text-income">
            {report.incomes.some((i) => i.approx) ? '≈ ' : ''}+{formatMoney(report.totalIncome, 'KGS')}
          </span>
        }
      >
        {report.incomes.length === 0 ? (
          <p className="text-caption text-muted">В этом месяце доходов нет</p>
        ) : (
          <ul className="space-y-1.5">
            {report.incomes.map((i) => (
              <li key={i.name} className="flex justify-between gap-3">
                <span className="truncate">{i.name}</span>
                <span className="tabular shrink-0">
                  {i.approx ? '≈ ' : ''}
                  {formatMoney(i.total, 'KGS')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {report.insights.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-h2 font-semibold">Где можно сократить</h2>
          {report.insights.map((i) => (
            <button
              key={i.kind + i.title}
              type="button"
              onClick={() => openInsight(i)}
              className="flex w-full gap-3 rounded-2xl bg-surface p-4 text-left active:opacity-80"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warn/10 text-warn">
                <Lightbulb size={18} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className={`block font-semibold ${i.kind === 'growth' ? 'text-warn' : ''}`}>{i.title}</span>
                <span className="tabular mt-0.5 block text-caption text-muted">{i.text}</span>
              </span>
            </button>
          ))}
        </section>
      )}

      {detail && <CategoryDetail stat={detail} month={month} onClose={() => setDetail(null)} />}
    </div>
  );
}
