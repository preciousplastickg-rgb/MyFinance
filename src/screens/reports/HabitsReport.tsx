import { useState } from 'react';
import { useToday } from '../../app/nav';
import { bestStreak, currentStreak, rate30, streakUnit } from '../../domain/habits';
import { plural } from '../../domain/money';
import { IconCircle } from '../../ui/icons';
import { HabitDetail } from '../habits/HabitDetail';
import { useHabitViews } from '../habits/HabitsView';
import { colorCss } from '../../domain/catalog';

/** «Отчёты → Привычки»: выполнение за 30 дней и серии (SPEC 7a). */
export function HabitsReport() {
  const views = useHabitViews();
  const today = useToday();
  // Тап по привычке — её календарь и серии (этап 18).
  const [open, setOpen] = useState<string | null>(null);
  const current = views.find((v) => v.habit.id === open);
  return (
    <div className="space-y-4">
      <section className="card px-4 py-1" aria-label="Привычки за 30 дней">
        {views.length === 0 && <p className="py-3 text-[14px] text-muted">Привычек пока нет — добавьте на вкладке «Дела → Привычки».</p>}
        {views.map((v, idx) => {
          const cur = currentStreak(v, today);
          const best = Math.max(bestStreak(v, today), cur);
          const unit = streakUnit(v.habit);
          const rate = rate30(v, today);
          return (
            <button
              key={v.habit.id}
              type="button"
              onClick={() => setOpen(v.habit.id)}
              className={`block w-full py-3 text-left ${idx ? 'border-t border-line' : ''}`}
            >
              <div className="flex items-center gap-2.5">
                <IconCircle name={v.habit.icon} color={v.habit.color} size={32} />
                <span className="min-w-0 flex-1 truncate font-medium">{v.habit.name}</span>
                <span className="tabular font-semibold">
                  {rate}%
                </span>
              </div>
              <div className="mt-2 mb-1.5 ml-[42px] h-1.5 overflow-hidden rounded-[3px] bg-sunk">
                <div className="h-full rounded-[3px]" style={{ width: `${rate}%`, background: colorCss(v.habit.color) }} />
              </div>
              <p className="tabular ml-[42px] text-[12px] text-muted">
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
