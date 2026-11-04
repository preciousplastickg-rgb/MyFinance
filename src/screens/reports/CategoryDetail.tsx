import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { formatDayTitle, formatMonthKey, monthOf, monthShort, type MonthKey } from '../../domain/date';
import { formatAmount, formatMoney } from '../../domain/money';
import { categoryTrend, type CategoryStat } from '../../domain/reports';
import { Bars } from '../../ui/charts';
import { IconCircle } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { TransactionRow } from '../../ui/TransactionRow';
import { BASE_CURRENCY } from '../../domain/currency';

/** Детализация категории: столбцы за 6 месяцев и операции месяца (SPEC 6). */
export function CategoryDetail({ stat, month, onClose }: { stat: CategoryStat; month: MonthKey; onClose: () => void }) {
  const { transactions, accountById, rates } = useData();
  const today = useToday();
  const trend = categoryTrend(stat.category.id, month, transactions, accountById, rates);
  const list = transactions
    .filter((t) => t.type === 'expense' && t.categoryId === stat.category.id && monthOf(t.date) === month)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));

  return (
    <Sheet title={stat.category.name} onClose={onClose} full>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <IconCircle name={stat.category.icon} color={stat.category.color} size={48} />
          <div>
            <p className="tabular text-h2 font-semibold">
              {stat.approx ? '≈ ' : ''}
              {formatMoney(stat.total, BASE_CURRENCY)}
            </p>
            <p className="text-caption text-muted">
              {formatMonthKey(month)} · {stat.count} операций
              {stat.average !== undefined ? ` · обычно ${formatAmount(stat.average)}` : ''}
            </p>
          </div>
        </div>
        <Bars
          color={stat.category.color}
          highlight={month}
          items={trend.map((t) => ({ key: t.month, label: monthShort(t.month), value: t.total, top: t.total ? formatAmount(Math.round(t.total / 100) * 100) : '' }))}
        />
        <div className="divide-y divide-line overflow-hidden rounded-card ring-1 ring-line">
          {list.map((t, i) => (
            <div key={t.id}>
              {(i === 0 || list[i - 1]!.date !== t.date) && (
                <p className="bg-bg px-4 pt-2 pb-1 text-caption font-semibold text-muted">{formatDayTitle(t.date, today)}</p>
              )}
              <TransactionRow tx={t} />
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
