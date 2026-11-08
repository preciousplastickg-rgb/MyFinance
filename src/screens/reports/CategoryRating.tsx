import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { colorCss } from '../../domain/catalog';
import { monthShort } from '../../domain/date';
import { formatAmount, plural } from '../../domain/money';
import { categoryCard, categoryShares, categoryTrend, type CategoryCard, type CategoryStat, type MonthReport } from '../../domain/reports';
import type { Id } from '../../domain/types';
import { Sparkline } from '../../ui/charts';
import { IconCircle } from '../../ui/icons';

/** Δ к среднему: рост от 20% — оранжевым, снижение — зелёным, остальное — серым. */
function Delta({ delta }: { delta: number }) {
  const cls = delta >= 20 ? 'text-warn' : delta < 0 ? 'text-income' : 'text-muted';
  return (
    <span className={`tabular shrink-0 text-caption font-semibold ${cls}`}>
      {delta > 0 ? '+' : '−'}
      {Math.abs(delta)}%
    </span>
  );
}

/**
 * «Куда ушли деньги» (этап 30, SPEC 6; вместо кольца): полоса долей категорий и строки по убыванию суммы. Тап по строке или
 * сегменту полосы раскрывает категорию — одна открыта, остальные сегменты бледнеют; в раскрытой — спарклайн за полгода,
 * доля, «обычно», покупки или источник и «Все операции» (детализация). Всё сразу, без анимаций (этап 29).
 */
export function CategoryRating({ report, onDetail }: { report: MonthReport; onDetail: (stat: CategoryStat) => void }) {
  const { transactions, accountById, rates, recurring } = useData();
  const today = useToday();
  const [open, setOpen] = useState<Id | null>(null);
  useEffect(() => setOpen(null), [report.month]);
  const shares = useMemo(() => categoryShares(report.byCategory), [report.byCategory]);
  const toggle = (id: Id) => setOpen((cur) => (cur === id ? null : id));
  const compared = report.comparisons && report.byCategory.some((s) => s.average !== undefined);

  // Полоса — одна зона нажатия во всю ширину (узкий сегмент кнопкой не сделать ≥ 44 px): сегмент — по месту тапа.
  const pickSegment = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const at = ((e.clientX - rect.left) / rect.width) * report.totalExpense;
    let acc = 0;
    for (const s of report.byCategory) {
      acc += s.total;
      if (at <= acc) return toggle(s.category.id);
    }
  };

  return (
    <section className="card px-4 pt-4 pb-1" aria-label="Куда ушли деньги">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="shrink-0 font-semibold">Куда ушли деньги</h2>
        {/* Текущий месяц сравнивается с теми же числами прошлых (SPEC 6, «Δ к среднему»). */}
        {compared && <span className="min-w-0 truncate text-caption text-muted">{report.sameDay ? `к среднему за 1–${report.sameDay} число` : 'к среднему за 3 мес.'}</span>}
      </div>
      {report.totalExpense === 0 ? (
        <p className="py-4 text-center text-[14px] text-muted">В этом месяце расходов нет</p>
      ) : (
        <>
          <div aria-hidden onClick={pickSegment} className="flex h-11 cursor-pointer items-center">
            <div className="flex h-3.5 w-full gap-0.5 overflow-hidden rounded-[7px]">
              {report.byCategory.map((s) => (
                <span
                  key={s.category.id}
                  className="block h-full min-w-[3px] basis-0"
                  style={{ flexGrow: s.total, background: colorCss(s.category.color), opacity: open && open !== s.category.id ? 0.35 : 1 }}
                />
              ))}
            </div>
          </div>
          <ul aria-label="Категории расходов">
            {report.byCategory.map((s, i) => {
              const id = s.category.id;
              const isOpen = open === id;
              const color = colorCss(s.category.color);
              return (
                <li key={id} className={i ? 'border-t border-line' : ''}>
                  <button type="button" aria-expanded={isOpen} onClick={() => toggle(id)} className="flex min-h-[54px] w-full items-center gap-3 py-2.5 text-left">
                    <IconCircle name={s.category.icon} color={s.category.color} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate font-medium">{s.category.name}</span>
                        {s.category.isFixed ? <span className="shrink-0 text-caption font-semibold text-muted">регулярный</span> : s.delta !== undefined && <Delta delta={s.delta} />}
                        <span className="tabular shrink-0 text-right font-semibold">
                          {s.approx ? '≈ ' : ''}
                          {formatAmount(s.total)}
                        </span>
                      </span>
                      <span className="mt-1.5 block h-1 overflow-hidden rounded-[2px] bg-sunk">
                        <span className="block h-full rounded-[2px]" style={{ width: `${Math.max(2, shares[i]?.rel ?? 0)}%`, background: color }} />
                      </span>
                    </span>
                  </button>
                  {isOpen && (
                    <Expanded
                      stat={s}
                      card={categoryCard(s, shares[i]?.percent ?? 0, categoryTrend(id, report.month, transactions, accountById, rates), recurring, report.firstDate, today)}
                      color={color}
                      onAll={() => onDetail(s)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function Expanded({ stat, card, color, onAll }: { stat: CategoryStat; card: CategoryCard; color: string; onAll: () => void }) {
  const usual = [
    card.usual !== undefined ? `Обычно ${formatAmount(card.usual)}` : '',
    card.range ? `${card.usual !== undefined ? 'за полгода' : 'За полгода'} ${formatAmount(card.range.min)}–${formatAmount(card.range.max)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="mb-3 ml-11 rounded-[16px] bg-sunk px-3 pt-3">
      <div className="flex items-center gap-3">
        <Sparkline
          values={card.trend.map((t) => t.total)}
          color={color}
          label={`${stat.category.name} за полгода: ${card.trend.map((t) => `${monthShort(t.month)} ${formatAmount(t.total)}`).join(', ')}`}
        />
        <div className="tabular min-w-0 flex-1 text-[13px] leading-snug">
          <p className="font-semibold">{card.share}% всех расходов</p>
          {usual && <p className="text-muted">{usual}</p>}
          {card.purchases && (
            <p className="text-muted">
              {card.purchases.count} {plural(card.purchases.count, ['покупка', 'покупки', 'покупок'])} · средний чек {formatAmount(card.purchases.avgCheck)}
            </p>
          )}
          {card.source && <p className="text-muted">{card.source}</p>}
        </div>
      </div>
      <button type="button" onClick={onAll} className="mt-1 flex min-h-11 w-full items-center text-[14px] font-semibold text-accent">
        Все операции
      </button>
    </div>
  );
}
