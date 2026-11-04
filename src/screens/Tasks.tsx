import { CalendarClock, CalendarDays, Plus, Sun } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNav, useToday } from '../app/nav';
import { applyTaskChange } from '../data/actions';
import { useData } from '../data/DataProvider';
import { addDays, formatDayTitle, formatShortDate } from '../domain/date';
import { badgeText, createTask, taskLists } from '../domain/tasks';
import type { Id, LocalDate } from '../domain/types';
import { Button, Chip, Field, Row, Segmented, TextInput } from '../ui/controls';
import { IconCircle } from '../ui/icons';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Sheet } from '../ui/Sheet';
import { HabitsView } from './habits/HabitsView';
import { TaskGroup } from './tasks/TaskList';

type TasksTab = 'today' | 'upcoming' | 'inbox';
const TAB_TITLES: Record<TasksTab, string> = { today: 'Сегодня', upcoming: 'Предстоящие', inbox: 'Входящие' };

/** «Дела»: поле добавления, вкладки Сегодня · Предстоящие · Входящие (SPEC 7.1). */
export function Tasks() {
  const { tasksMode, showTasks } = useNav();
  return (
    <>
      <ScreenHeader title="Дела" />
      <div className="space-y-4 px-4">
        <Segmented
          label="Раздел"
          value={tasksMode}
          onChange={showTasks}
          options={[
            { value: 'tasks', label: 'Задачи' },
            { value: 'habits', label: 'Привычки' },
          ]}
        />
        {tasksMode === 'tasks' ? <TaskLists /> : <HabitsView />}
      </div>
    </>
  );
}

function TaskLists() {
  const { tasks, areas } = useData();
  const today = useToday();
  const lists = useMemo(() => taskLists(tasks, today), [tasks, today]);
  const [tab, setTab] = useState<TasksTab>('today');
  const defaultDate = (t: TasksTab) => (t === 'today' ? today : t === 'upcoming' ? addDays(today, 1) : undefined);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<LocalDate | undefined>(today);
  const [time, setTime] = useState<string | undefined>();
  const [areaId, setAreaId] = useState<Id | undefined>();
  const [sheet, setSheet] = useState<'when' | 'area' | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const switchTab = (t: TasksTab) => {
    setTab(t);
    setDate(defaultDate(t));
    setTime(undefined);
  };
  const add = () => {
    if (!title.trim()) return;
    void applyTaskChange(createTask({ title, date, ...(date && time ? { time } : {}), ...(areaId ? { areaId } : {}) }, Date.now()));
    setTitle('');
    input.current?.focus();
  };

  const area = areas.find((a) => a.id === areaId);
  const counts = { today: lists.counts.today, upcoming: lists.counts.upcoming, inbox: lists.counts.inbox };
  const isTomorrow = date === addDays(today, 1);
  const custom = date && date !== today && !isTomorrow;

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input
              ref={input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Новая задача"
              aria-label="Новая задача"
              enterKeyHint="done"
              className="block min-h-11 w-full rounded-ctl bg-surface pr-12 pl-3 ring-1 ring-line outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              aria-label="Добавить задачу"
              disabled={!title.trim()}
              className="absolute top-0 right-0 flex size-11 items-center justify-center rounded-ctl text-accent disabled:text-muted"
            >
              <Plus size={22} aria-hidden />
            </button>
          </form>
          <div className="flex flex-wrap gap-2">
            <Chip selected={date === today} onClick={() => setDate(date === today ? undefined : today)}>
              <Sun size={16} aria-hidden /> Сегодня
            </Chip>
            <Chip selected={isTomorrow} onClick={() => setDate(isTomorrow ? undefined : addDays(today, 1))}>
              <CalendarDays size={16} aria-hidden /> Завтра
            </Chip>
            <Chip selected={!!custom || !!time} onClick={() => setSheet('when')}>
              <CalendarClock size={16} aria-hidden />
              {custom || time ? `${date ? formatShortDate(date) : ''}${time ? `, ${time}` : ''}` : 'Дата и время'}
            </Chip>
            <Chip selected={!!area} onClick={() => setSheet('area')}>
              {area ? <IconCircle name={area.icon} color={area.color} size={22} /> : null}
              {area ? area.name : 'Сфера'}
            </Chip>
          </div>
        </div>

        <div role="tablist" aria-label="Списки дел" className="grid grid-cols-3 gap-2 pt-2">
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
                aria-label={`${TAB_TITLES[t]}, задач: ${counts[t]}`}
                onClick={() => switchTab(t)}
                className={`relative min-h-11 rounded-ctl px-1 text-caption font-semibold ${selected ? 'bg-primary text-white' : 'bg-surface text-muted ring-1 ring-line'}`}
              >
                {TAB_TITLES[t]}
                {badge && (
                  <span
                    aria-hidden
                    data-badge
                    className={`tabular absolute -top-[9px] -right-[3px] flex h-5 min-w-5 items-center justify-center rounded-[4px] border-2 border-bg px-1 text-[11px] leading-none font-bold text-white ${
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
            <TaskGroup title="Сделано сегодня" tasks={lists.doneToday} swipe={false} />
            {lists.counts.today === 0 && lists.doneToday.length === 0 && <Empty text="На сегодня дел нет" />}
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
        {tab === 'inbox' && (
          <>
            <TaskGroup tasks={lists.inbox} />
            {lists.inbox.length === 0 && <Empty text="Входящие пусты — задачи без даты попадают сюда" />}
          </>
        )}
      </div>

      {sheet === 'when' && (
        <WhenSheet
          date={date}
          time={time}
          onSave={(d, t) => {
            setDate(d);
            setTime(t);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'area' && (
        <Sheet title="Сфера" onClose={() => setSheet(null)}>
          <div className="divide-y divide-line">
            <Row onClick={() => (setAreaId(undefined), setSheet(null))} className="px-0">
              <span className="flex-1">Без сферы</span>
            </Row>
            {areas
              .filter((a) => !a.archived)
              .map((a) => (
                <Row key={a.id} onClick={() => (setAreaId(a.id), setSheet(null))} className="px-0">
                  <IconCircle name={a.icon} color={a.color} />
                  <span className="flex-1">{a.name}</span>
                </Row>
              ))}
          </div>
        </Sheet>
      )}
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-card bg-surface p-4 text-center text-muted">{text}</p>;
}

function WhenSheet({
  date,
  time,
  onSave,
  onClose,
}: {
  date?: LocalDate;
  time?: string;
  onSave: (date: LocalDate | undefined, time: string | undefined) => void;
  onClose: () => void;
}) {
  const [d, setD] = useState(date ?? '');
  const [t, setT] = useState(time ?? '');
  return (
    <Sheet title="Дата и время" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата">{(id) => <TextInput id={id} type="date" value={d} onChange={(e) => setD(e.target.value)} />}</Field>
          <Field label="Время">{(id) => <TextInput id={id} type="time" value={t} onChange={(e) => setT(e.target.value)} />}</Field>
        </div>
        <Button
          className="w-full"
          onClick={() => {
            onSave(d || undefined, d && t ? t : undefined);
            onClose();
          }}
        >
          Готово
        </Button>
      </div>
    </Sheet>
  );
}
