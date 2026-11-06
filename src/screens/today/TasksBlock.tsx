import { useMemo } from 'react';
import { useNav, useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { addDays, formatDayTitle } from '../../domain/date';
import { homeTasks, taskLists } from '../../domain/tasks';
import { TaskGroup } from '../tasks/TaskList';
import { SectionHeader } from '../../ui/SectionHeader';

const more = (n: number) => (n > 0 ? ` · ещё ${n}` : '');

/** «Дела»: сегодня (с просроченными) и завтра, всего до 6 задач, важные первыми (SPEC 5.1 п. 6). */
export function TasksBlock() {
  const { tasks, taskEvents } = useData();
  const today = useToday();
  const { showTasks } = useNav();
  const lists = useMemo(() => taskLists(tasks, today, taskEvents), [tasks, today, taskEvents]);
  const home = homeTasks(lists, today);
  const openTasks = () => showTasks('tasks');
  return (
    <section className="space-y-2">
      <SectionHeader title="Дела" right="Все дела" onClick={openTasks} />
      {home.today.length ? (
        <TaskGroup title={formatDayTitle(today, today) + more(home.todayMore)} tasks={home.today} />
      ) : (
        <p className="rounded-card bg-surface px-4 py-4 text-caption text-muted">
          {lists.doneToday.length ? `На сегодня всё сделано: ${lists.doneToday.length}` : 'На сегодня дел нет'}
        </p>
      )}
      <TaskGroup title={formatDayTitle(addDays(today, 1), today) + more(home.tomorrowMore)} tasks={home.tomorrow} />
    </section>
  );
}
