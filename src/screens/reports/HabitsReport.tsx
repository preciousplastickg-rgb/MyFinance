import { useToday } from '../../app/nav';
import { abstainDays, bestStreak, currentStreak, rate30 } from '../../domain/habits';
import { plural } from '../../domain/money';
import { IconCircle } from '../../ui/icons';
import { useHabitViews } from '../habits/HabitsView';
import { WorkoutsProgress } from './WorkoutsProgress';

/** «Отчёты → Привычки»: выполнение за 30 дней и серии (SPEC 7a). */
export function HabitsReport() {
  const views = useHabitViews();
  const today = useToday();
  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-card bg-surface p-4">
        <h2 className="text-h2 font-semibold">Привычки за 30 дней</h2>
        {views.length === 0 && <p className="text-caption text-muted">Привычек пока нет — добавьте на вкладке «Дела → Привычки».</p>}
        {views.map((v) => {
          const abstain = v.habit.kind === 'abstain';
          const cur = abstain ? abstainDays(v, today) : currentStreak(v, today);
          const best = Math.max(bestStreak(v, today), cur);
          const unit = v.habit.kind === 'weekly' ? (['неделя', 'недели', 'недель'] as const) : (['день', 'дня', 'дней'] as const);
          const rate = rate30(v, today);
          return (
            <div key={v.habit.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <IconCircle name={v.habit.icon} color={v.habit.color} size={28} />
                <span className="min-w-0 flex-1 truncate">{v.habit.name}</span>
                <span className="tabular text-caption font-semibold">{rate}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-[2px] bg-line">
                <div className="h-full rounded-[2px]" style={{ width: `${rate}%`, background: v.habit.color }} />
              </div>
              <p className="tabular text-caption text-muted">
                {abstain ? 'Без срыва' : 'Серия'} {cur} {plural(cur, unit)} · лучшая {best} {plural(best, unit)}
              </p>
            </div>
          );
        })}
      </section>
      <WorkoutsProgress />
    </div>
  );
}
