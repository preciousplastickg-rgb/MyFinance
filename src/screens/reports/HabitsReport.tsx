import { useState } from 'react';
import { useToday } from '../../app/nav';
import { bestStreak, currentStreak, rate30, streakUnit } from '../../domain/habits';
import { plural } from '../../domain/money';
import { CountUp } from '../../ui/charts';
import { IconCircle } from '../../ui/icons';
import { HabitDetail } from '../habits/HabitDetail';
import { useHabitViews } from '../habits/HabitsView';

/** «Отчёты → Привычки»: выполнение за 30 дней и серии (SPEC 7a). */
export function HabitsReport() {
  const views = useHabitViews();
  const today = useToday();
  // Тап по привычке — её календарь и серии (этап 18).
  const [open, setOpen] = useState<string | null>(null);
  const current = views.find((v) => v.habit.id === open);
  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-card bg-surface p-4">
        <h2 className="text-h2 font-semibold">Привычки за 30 дней</h2>
        {views.length === 0 && <p className="text-caption text-muted">Привычек пока нет — добавьте на вкладке «Дела → Привычки».</p>}
        {views.map((v) => {
          const cur = currentStreak(v, today);
          const best = Math.max(bestStreak(v, today), cur);
          const unit = streakUnit(v.habit);
          const rate = rate30(v, today);
          return (
            <button
              key={v.habit.id}
              type="button"
              onClick={() => setOpen(v.habit.id)}
              className="-mx-2 block w-[calc(100%+16px)] space-y-1.5 rounded-ctl px-2 py-1 text-left active:bg-bg"
            >
              <div className="flex items-center gap-2">
                <IconCircle name={v.habit.icon} color={v.habit.color} size={28} />
                <span className="min-w-0 flex-1 truncate">{v.habit.name}</span>
                <span className="tabular text-caption font-semibold">
                  <CountUp value={rate} format={(n) => `${n}%`} duration={600} />
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-[2px] bg-line">
                <div className="jar-fill h-full rounded-[2px]" style={{ width: `${rate}%`, background: v.habit.color }} />
              </div>
              <p className="tabular text-caption text-muted">
                Серия {cur} {plural(cur, unit)} · лучшая {best} {plural(best, unit)}
              </p>
            </button>
          );
        })}
      </section>
      {current && <HabitDetail view={current} onClose={() => setOpen(null)} />}
    </div>
  );
}
