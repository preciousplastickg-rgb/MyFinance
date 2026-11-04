import { ChevronRight } from 'lucide-react';
import { useNav, useToday } from '../../app/nav';
import { HabitList, useHabitViews } from '../habits/HabitsView';

/** «Привычки» на «Сегодня»: отметка одним тапом (SPEC 7a.1). Без привычек блока нет. */
export function HabitsBlock() {
  const views = useHabitViews();
  const today = useToday();
  const { showTasks } = useNav();
  if (!views.length) return null;
  const done = views.filter((v) => v.done(today)).length;
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-h2 font-semibold">Привычки</h2>
        <button type="button" onClick={() => showTasks('habits')} className="-mr-2 flex min-h-11 items-center gap-0.5 px-2 text-caption font-medium text-accent">
          {done} из {views.length} сегодня
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
      <HabitList views={views} />
    </section>
  );
}
