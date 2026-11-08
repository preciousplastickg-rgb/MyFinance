import { useMemo } from 'react';
import { ChevronDown, ChevronRight } from '../../ui/glyphs';
import { useNav, useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { addDays, formatDayTitle } from '../../domain/date';
import { homeTasks, taskLists } from '../../domain/tasks';
import { plural } from '../../domain/money';
import { TaskGroup } from '../tasks/TaskList';
import { SectionHeader } from '../../ui/SectionHeader';
import { useRememberedOpen } from '../../ui/useRememberedOpen';

const more = (n: number) => (n > 0 ? ` · ещё ${n}` : '');

/**
 * «Дела»: сегодня (с просроченными) и завтра в одной карточке, всего до 6 задач, важные первыми (SPEC 5.1 п. 6).
 * Этап 29: сворачивается тапом по заголовку, как «Счета» (состояние запоминается); «Все дела» — строкой внизу.
 */
export function TasksBlock() {
  const { tasks, taskEvents } = useData();
  const today = useToday();
  const { showTasks } = useNav();
  const [open, setOpen] = useRememberedOpen('today-tasks-open', true);
  const lists = useMemo(() => taskLists(tasks, today, taskEvents), [tasks, today, taskEvents]);
  const home = homeTasks(lists, today);
  const n = lists.counts.today;
  const summary = n ? `${n} ${plural(n, ['дело', 'дела', 'дел'])} сегодня${lists.counts.overdue ? ` · ${lists.counts.overdue} просрочено` : ''}` : 'на сегодня пусто';
  return (
    <section>
      <SectionHeader
        title="Дела"
        onClick={() => setOpen(!open)}
        expanded={open}
        right={<span className={lists.counts.overdue ? 'text-warn' : undefined}>{summary}</span>}
        icon={<ChevronDown size={16} aria-hidden className={open ? 'rotate-180' : undefined} />}
      />
      {open && (
        <div className="card overflow-hidden pt-2">
          {home.today.length ? (
            <TaskGroup bare title={formatDayTitle(today, today) + more(home.todayMore)} tasks={home.today} />
          ) : (
            <p className="px-4 py-2 text-[14px] text-muted">
              {lists.doneToday.length ? `На сегодня всё сделано: ${lists.doneToday.length}` : 'На сегодня дел нет'}
            </p>
          )}
          <TaskGroup bare title={formatDayTitle(addDays(today, 1), today) + more(home.tomorrowMore)} tasks={home.tomorrow} />
          <button
            type="button"
            onClick={() => showTasks('tasks')}
            className="mt-1 flex min-h-11 w-full items-center justify-between border-t border-line px-4 text-left text-caption font-medium text-accent active:bg-sunk"
          >
            Все дела
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      )}
    </section>
  );
}
