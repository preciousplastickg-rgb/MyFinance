import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNav, useToday, type TasksMode } from '../app/nav';
import { useAddAction } from '../app/useAddAction';
import { SectionPager } from '../app/SectionPager';
import { useData } from '../data/DataProvider';
import { fabPositionOf } from '../domain/appearance';
import { addDays, formatDayTitle } from '../domain/date';
import { badgeText, taskLists } from '../domain/tasks';
import { Row, Segmented } from '../ui/controls';
import { ScreenHeader } from '../ui/ScreenHeader';
import { GoalsList } from './Goals';
import { HabitsView } from './habits/HabitsView';
import { TaskCard } from './tasks/TaskCard';
import { TaskGroup } from './tasks/TaskList';

type TasksTab = 'today' | 'upcoming' | 'inbox' | 'done';
const MODE_TITLES: Record<TasksMode, string> = { tasks: 'Задачи', habits: 'Привычки', goals: 'Цели' };
const TAB_TITLES: Record<TasksTab, string> = { today: 'Сегодня', upcoming: 'Впереди', inbox: 'Без даты', done: 'Сделано' };

/**
 * «Дела»: вкладки Сегодня · Впереди · Без даты · Сделано (SPEC 7.1); новая задача — окном по «+» в меню (этап 28).
 * При «+» по центру (этап 26) третий раздел — «Цели»: вкладки «Цели» в меню тогда нет.
 */
export function Tasks() {
  const { tasksMode, showTasks } = useNav();
  const { settings } = useData();
  const withGoals = fabPositionOf(settings) === 'center';
  const modes: readonly TasksMode[] = withGoals || tasksMode === 'goals' ? ['tasks', 'habits', 'goals'] : ['tasks', 'habits'];
  return (
    <>
      <ScreenHeader title="Дела" />
      <div className="space-y-4 px-4">
        <Segmented
          label="Раздел"
          value={tasksMode}
          onChange={showTasks}
          options={modes.map((m) => ({ value: m, label: MODE_TITLES[m] }))}
        />
        <SectionPager items={modes} current={tasksMode} render={(m) => (m === 'tasks' ? <TaskLists /> : m === 'habits' ? <HabitsView /> : <GoalsList />)} />
      </div>
    </>
  );
}

function TaskLists() {
  const { tasks, taskEvents } = useData();
  const today = useToday();
  const lists = useMemo(() => taskLists(tasks, today, taskEvents), [tasks, today, taskEvents]);
  const [tab, setTab] = useState<TasksTab>('today');
  const [adding, setAdding] = useState(false);
  // Дата новой задачи по вкладке: Сегодня и Сделано → сегодня, Впереди → завтра, Без даты → без даты.
  const defaultDate = (t: TasksTab) => (t === 'today' || t === 'done' ? today : t === 'upcoming' ? addDays(today, 1) : undefined);
  // «+» в меню на «Задачах» открывает окно новой задачи (этап 28); поля сверху больше нет.
  useAddAction('Новая задача', () => setAdding(true));

  const counts = { today: lists.counts.today, upcoming: lists.counts.upcoming, inbox: lists.counts.inbox, done: 0 };

  return (
    <>
      <div className="space-y-4">
        {/* Четыре вкладки равными колонками: на телефоне все видны сразу, без горизонтальной прокрутки (этап 27). */}
        <div role="tablist" aria-label="Списки дел" className="grid grid-cols-4 gap-1 pt-0.5 pb-1">
          {(Object.keys(TAB_TITLES) as TasksTab[]).map((t) => {
            const badge = badgeText(counts[t]);
            const selected = tab === t;
            const warn = t === 'today' && lists.counts.overdue > 0;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={t === 'done' ? TAB_TITLES[t] : `${TAB_TITLES[t]}, задач: ${counts[t]}`}
                onClick={() => setTab(t)}
                // overflow-visible, а не truncate: бейдж вынесен за край кнопки (−9 px вверх), overflow: hidden его срезал.
                className={`tap-44 min-h-9 overflow-visible rounded-full px-1 text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 ${selected ? 'bg-ink text-bg' : 'text-muted'}`}
              >
                {TAB_TITLES[t]}
                {badge && (
                  <span
                    aria-hidden
                    data-badge
                    className={`tabular absolute -top-[9px] -right-[3px] flex h-5 min-w-5 items-center justify-center rounded-[10px] border-2 border-bg px-1 text-[11px] leading-none font-bold text-on-primary ${
                      warn ? 'bg-warn' : 'bg-primary'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === 'today' && (
          <>
            <TaskGroup title="Просрочено" titleClass="text-warn" tasks={lists.overdue} />
            <TaskGroup title={lists.overdue.length ? formatDayTitle(today, today) : undefined} tasks={lists.today} />
            {lists.counts.today === 0 && <Empty text={lists.doneToday.length ? 'На сегодня всё сделано' : 'На сегодня дел нет. Добавить — «+» в меню'} />}
            {lists.doneToday.length > 0 && (
              <Row onClick={() => setTab('done')} className="card">
                <span className="flex-1 text-muted">Сделано сегодня: {lists.doneToday.length}</span>
                <ChevronRight size={18} className="text-muted" aria-hidden />
              </Row>
            )}
          </>
        )}
        {tab === 'upcoming' && (
          <>
            {lists.upcoming.map((g) => (
              <TaskGroup key={g.date} title={formatDayTitle(g.date, today)} tasks={g.tasks} />
            ))}
            <TaskGroup title="Позже" tasks={lists.later} />
            {lists.counts.upcoming === 0 && <Empty text="Впереди пусто" />}
          </>
        )}
        {tab === 'done' && (
          <>
            {lists.done.map((g) => (
              <TaskGroup key={g.date} title={formatDayTitle(g.date, today)} tasks={g.tasks} swipe={false} completed />
            ))}
            {lists.done.length === 0 && <Empty text="Выполненных дел пока нет" />}
          </>
        )}
        {tab === 'inbox' && (
          <>
            <TaskGroup tasks={lists.inbox} />
            {lists.inbox.length === 0 && <Empty text="Здесь задачи, у которых не указана дата: идеи и дела «когда-нибудь». Сейчас таких нет" />}
          </>
        )}
      </div>

      {adding && (
        <TaskCard
          isNew
          task={{ id: '', title: '', important: false, status: 'open', postponeCount: 0, createdAt: 0, ...(defaultDate(tab) ? { date: defaultDate(tab) } : {}) }}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="card px-4 py-5 text-center text-[14px] text-muted">{text}</p>;
}
