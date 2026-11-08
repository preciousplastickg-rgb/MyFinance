import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { useState } from 'react';
import { formatMonthKey, monthOf, monthShort, type MonthKey } from '../../domain/date';
import { formatAmount, formatMoney, plural } from '../../domain/money';
import type { Transaction } from '../../domain/types';
import { categoryTrend, type CategoryStat } from '../../domain/reports';
import { Bars } from '../../ui/charts';
import { IconCircle } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { TransactionEditor } from '../entry/TransactionEditor';
import { TxList } from './TxListSheet';
import { BASE_CURRENCY } from '../../domain/currency';
import { colorCss } from '../../domain/catalog';

/** Детализация категории: столбцы за 6 месяцев и операции месяца (SPEC 6). */
export function CategoryDetail({ stat, month: initialMonth, onClose }: { stat: CategoryStat; month: MonthKey; onClose: () => void }) {
  const { transactions, accountById, rates } = useData();
  const today = useToday();
  // Тап по столбцу — операции того месяца (этап 18); тренд остаётся от месяца отчёта.
  const [month, setMonth] = useState(initialMonth);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const trend = categoryTrend(stat.category.id, initialMonth, transactions, accountById, rates);
  const shown = trend.find((t) => t.month === month);
  const list = transactions
    .filter((t) => t.type === 'expense' && t.categoryId === stat.category.id && monthOf(t.date) === month)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));

  return (
    <Sheet title={stat.category.name} onClose={onClose} full>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <IconCircle name={stat.category.icon} color={colorCss(stat.category.color)} size={48} />
          <div>
            <p className="tabular text-h2 font-semibold">
              {month === initialMonth && stat.approx ? '≈ ' : ''}
              {formatMoney(month === initialMonth ? stat.total : (shown?.total ?? 0), BASE_CURRENCY)}
            </p>
            <p className="text-caption text-muted">
              {formatMonthKey(month)} · {list.length} {plural(list.length, ['операция', 'операции', 'операций'])}
              {month === initialMonth && stat.average !== undefined ? ` · обычно ${formatAmount(stat.average)}` : ''}
            </p>
          </div>
        </div>
        <Bars
          color={colorCss(stat.category.color)}
          highlight={month}
          onPick={setMonth}
          pickLabel={(i) => `${formatMonthKey(i.key)}: ${i.top || '0'}`}
          items={trend.map((t) => ({ key: t.month, label: monthShort(t.month), value: t.total, top: t.total ? formatAmount(Math.round(t.total / 100) * 100) : '' }))}
        />
        {list.length ? <TxList list={list} today={today} onOpen={setEditing} /> : <p className="py-5 text-center text-sub text-muted">Операций нет</p>}
      </div>
      {editing && <TransactionEditor tx={editing} onClose={() => setEditing(null)} />}
    </Sheet>
  );
}
