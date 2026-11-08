import { ChevronDown } from '../../ui/glyphs';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useData } from '../../data/DataProvider';
import { colorCss } from '../../domain/catalog';
import type { MonthKey } from '../../domain/date';
import type { LocalDate } from '../../domain/types';
import { categoryLimits, limitCaption, limitsSummary, type CategoryLimitView } from '../../domain/limits';
import { formatAmount } from '../../domain/money';
import type { CategoryStat } from '../../domain/reports';
import { IconCircle } from '../../ui/icons';
import { SectionHeader } from '../../ui/SectionHeader';
import { useRememberedOpen } from '../../ui/useRememberedOpen';

// Детализация категории живёт в чанке отчётов — в «Деньги» и «Сегодня» грузится только по тапу.
const CategoryDetail = lazy(() => import('../reports/CategoryDetail').then((m) => ({ default: m.CategoryDetail })));

/** Лимиты по категориям за месяц (этап 23) — те же операции, что в отчёте. */
export function useCategoryLimits(month: MonthKey, today: LocalDate): CategoryLimitView[] {
  const { transactions, categories, accountById, rates } = useData();
  return useMemo(() => categoryLimits({ month, today, transactions, categories, accountById, rates }), [month, today, transactions, categories, accountById, rates]);
}

export function asStat(v: CategoryLimitView): CategoryStat {
  return { category: v.category, total: v.spent, count: v.count, approx: v.approx };
}

/** Строка лимита: значок, название, полоса (цвет категории, перерасход — `--warn`), «4 200 из 6 000» и остаток. */
export function LimitRows({ views, onPick, label = 'Лимиты' }: { views: readonly CategoryLimitView[]; onPick: (v: CategoryLimitView) => void; label?: string }) {
  return (
    <ul className="card divide-y divide-line overflow-hidden py-1" aria-label={label}>
      {views.map((v) => {
        const caption = limitCaption(v);
        const over = v.status === 'over';
        return (
          <li key={v.category.id}>
            <button
              type="button"
              onClick={() => onPick(v)}
              aria-label={`${v.category.name}: ${formatAmount(v.spent)} из ${formatAmount(v.limit)}, ${caption.text}`}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-1.5 text-left active:bg-sunk"
            >
              <IconCircle name={v.category.icon} color={v.category.color} size={36} />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{v.category.name}</span>
                  <span className="tabular shrink-0 text-caption">
                    <b className={over ? 'text-warn' : ''}>{v.approx ? '≈ ' : ''}{formatAmount(v.spent)}</b>
                    <span className="text-muted"> из {formatAmount(v.limit)}</span>
                  </span>
                </span>
                <span className="block h-1.5 overflow-hidden rounded-[3px] bg-sunk">
                  <span className="block h-full rounded-[3px]" style={{ width: `${v.percent}%`, background: over ? 'var(--warn)' : colorCss(v.category.color) }} />
                </span>
                <span className={`tabular block text-caption ${caption.warn ? 'text-warn' : 'text-muted'}`}>{caption.text}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Блок «Лимиты» в «Деньгах»: как «Счета» — заголовок с итогом, тап сворачивает; нет лимитов — блока нет. */
export function LimitsBlock({ month, today, storageKey = 'money-limits-open' }: { month: MonthKey; today: LocalDate; storageKey?: string }) {
  const views = useCategoryLimits(month, today);
  const [open, setOpen] = useRememberedOpen(storageKey, true);
  const [picked, setPicked] = useState<CategoryLimitView | null>(null);
  if (!views.length) return null;
  const summary = limitsSummary(views);
  return (
    <section>
      <SectionHeader
        title="Лимиты"
        onClick={() => setOpen(!open)}
        expanded={open}
        label={open ? 'Свернуть лимиты' : 'Показать лимиты'}
        right={<span className={summary.over ? 'text-warn' : undefined}>{summary.text}</span>}
        icon={<ChevronDown size={16} aria-hidden className={open ? 'rotate-180' : undefined} />}
      />
      {open && <LimitRows views={views} onPick={setPicked} />}
      {picked && (
        <Suspense fallback={null}>
          <CategoryDetail stat={asStat(picked)} month={month} onClose={() => setPicked(null)} />
        </Suspense>
      )}
    </section>
  );
}
