import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { useNav, useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { taskLists } from '../../domain/tasks';
import { TaskGroup } from '../tasks/TaskList';

/** «Дела на сегодня»: до 5 задач и ссылка «Все дела» (SPEC 5.1 п. 6). */
export function TasksBlock() {
  const { tasks } = useData();
  const today = useToday();
  const { setTab } = useNav();
  const lists = useMemo(() => taskLists(tasks, today), [tasks, today]);
  const shown = [...lists.overdue, ...lists.today].slice(0, 5);
  const total = lists.counts.today;
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-h2 font-semibold">Дела на сегодня</h2>
        <button type="button" onClick={() => setTab('tasks')} className="-mr-2 flex min-h-11 items-center gap-0.5 px-2 text-caption font-medium text-accent">
          Все дела{total > 5 ? ` (${total})` : ''}
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
      {shown.length ? (
        <TaskGroup tasks={shown} />
      ) : (
        <p className="rounded-card bg-surface px-4 py-4 text-caption text-muted">
          {lists.doneToday.length ? `Всё сделано: ${lists.doneToday.length}` : 'На сегодня дел нет'}
        </p>
      )}
    </section>
  );
}
