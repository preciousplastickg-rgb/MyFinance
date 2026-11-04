import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { useNav, useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { addDays, formatDayTitle } from '../../domain/date';
import { plural } from '../../domain/money';
import { homeTasks, taskLists } from '../../domain/tasks';
import { TaskGroup } from '../tasks/TaskList';

const more = (n: number) => (n > 0 ? ` · ещё ${n}` : '');

/** «Дела»: сегодня (с просроченными) и завтра, по 5 задач, дальше — числом (SPEC 5.1 п. 6). */
export function TasksBlock() {
  const { tasks } = useData();
  const today = useToday();
  const { showTasks } = useNav();
  const lists = useMemo(() => taskLists(tasks, today), [tasks, today]);
  const home = homeTasks(lists, today);
  const openTasks = () => showTasks('tasks');
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-h2 font-semibold">Дела</h2>
        <button type="button" onClick={openTasks} className="-mr-2 flex min-h-11 items-center gap-0.5 px-2 text-caption font-medium text-accent">
          Все дела
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
      {home.today.length ? (
        <TaskGroup title={formatDayTitle(today, today) + more(home.todayMore)} tasks={home.today} />
      ) : (
        <p className="rounded-card bg-surface px-4 py-4 text-caption text-muted">
          {lists.doneToday.length ? `На сегодня всё сделано: ${lists.doneToday.length}` : 'На сегодня дел нет'}
        </p>
      )}
      <TaskGroup title={formatDayTitle(addDays(today, 1), today) + more(home.tomorrowMore)} tasks={home.tomorrow} />
      {home.laterCount > 0 && (
        <button type="button" onClick={openTasks} className="flex min-h-11 w-full items-center justify-between px-1 text-caption text-muted">
          Дальше — {home.laterCount} {plural(home.laterCount, ['дело', 'дела', 'дел'])}
          <ChevronRight size={16} aria-hidden />
        </button>
      )}
    </section>
  );
}
