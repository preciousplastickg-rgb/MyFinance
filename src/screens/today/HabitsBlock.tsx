import { useNav, useToday } from '../../app/nav';
import { SectionHeader } from '../../ui/SectionHeader';
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
      <SectionHeader title="Привычки" right={`${done} из ${views.length} сегодня`} onClick={() => showTasks('habits')} />
      <HabitList views={views} />
    </section>
  );
}
