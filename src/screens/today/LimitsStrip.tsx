import { lazy, Suspense, useState } from 'react';
import { useNav, useToday } from '../../app/nav';
import { monthOf } from '../../domain/date';
import { limitsSummary, type CategoryLimitView } from '../../domain/limits';
import { SectionHeader } from '../../ui/SectionHeader';
import { asStat, LimitRows, useCategoryLimits } from '../money/LimitsBlock';

const CategoryDetail = lazy(() => import('../reports/CategoryDetail').then((m) => ({ default: m.CategoryDetail })));

/**
 * «Лимиты» на «Сегодня» (этап 23): только категории на грани (≥ 80%) и сверх лимита за текущий месяц —
 * пока всё в рамках, блока нет. Заголовок ведёт в «Деньги», где лимиты целиком.
 */
export function LimitsStrip() {
  const today = useToday();
  const { setTab } = useNav();
  const views = useCategoryLimits(monthOf(today), today);
  const [picked, setPicked] = useState<CategoryLimitView | null>(null);
  const shown = views.filter((v) => v.status !== 'ok');
  if (!shown.length) return null;
  const summary = limitsSummary(views);
  return (
    <section>
      <SectionHeader title="Лимиты" onClick={() => setTab('money')} label="Лимиты: все в «Деньгах»" right={<span className={summary.over ? 'text-warn' : undefined}>{summary.text}</span>} />
      <LimitRows views={shown} onPick={setPicked} />
      {picked && (
        <Suspense fallback={null}>
          <CategoryDetail stat={asStat(picked)} month={monthOf(today)} onClose={() => setPicked(null)} />
        </Suspense>
      )}
    </section>
  );
}
