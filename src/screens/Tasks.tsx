import { CalendarClock, CalendarDays, ChevronRight, Plus, Sun } from 'lucide-react';
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

type TasksTab = 'today' | 'upcoming' | 'inbox' | 'done';
const TAB_TITLES: Record<TasksTab, string> = { today: 'Сегодня', upcoming: 'Предстоящие', inbox: 'Без даты', done: 'Выполненные' };

/** «Дела»: поле добавления, вкладки Сегодня · Предстоящие · Без даты · Выполненные (SPEC 7.1). */
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
  const { tasks, areas, taskEvents } = useData();
  const today = useToday();
  const lists = useMemo(() => taskLists(tasks, today, taskEvents), [tasks, today, taskEvents]);
  const [tab, setTab] = useState<TasksTab>('today');
  const defaultDate = (t: TasksTab) => (t === 'today' || t === 'done' ? today : t === 'upcoming' ? addDays(today, 1) : undefined);
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
  const counts = { today: lists.counts.today, upcoming: lists.counts.upcoming, inbox: lists.counts.inbox, done: 0 };
  const isTomorrow = date === addDays(today, 1);
  const custom = date && date !== today && !isTomorrow;
  // Дата и сфера новой задачи появляются, когда начали её писать: пустая форма не спорит со списком.
  const composing = title.trim() !== '' || sheet !== null || !!areaId || !!time || date !== defaultDate(tab);

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <form
            className="card flex min-h-12 items-center gap-1 rounded-ctl pr-2 pl-1"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <button type="submit" aria-label="Добавить задачу" disabled={!title.trim()} className="flex size-11 shrink-0 items-center justify-center text-muted">
              <Plus size={18} aria-hidden />
            </button>
            <input
              ref={input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={date === today ? 'Новая задача на сегодня' : isTomorrow ? 'Новая задача на завтра' : 'Новая задача'}
              aria-label="Новая задача"
              enterKeyHint="done"
              className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted/50"
            />
          </form>
          {composing && (
          <div className="flex flex-wrap gap-2" aria-label="Когда и сфера новой задачи" role="group">
            {/* Светлые чипы: тёмный «Сегодня» прямо над вкладкой «Сегодня» читался как её дубль. */}
            <Chip tone="soft" selected={date === today} onClick={() => setDate(date === today ? undefined : today)}>
              <Sun size={16} aria-hidden /> Сегодня
            </Chip>
            <Chip tone="soft" selected={isTomorrow} onClick={() => setDate(isTomorrow ? undefined : addDays(today, 1))}>
              <CalendarDays size={16} aria-hidden /> Завтра
            </Chip>
            <Chip tone="soft" selected={!!custom || !!time} onClick={() => setSheet('when')}>
              <CalendarClock size={16} aria-hidden />
              {custom || time ? `${date ? formatShortDate(date) : ''}${time ? `, ${time}` : ''}` : 'Дата и время'}
            </Chip>
            <Chip tone="soft" selected={!!area} onClick={() => setSheet('area')}>
              {area ? <IconCircle name={area.icon} color={area.color} size={22} /> : null}
              {area ? area.name : 'Сфера'}
            </Chip>
          </div>
          )}
        </div>

        {/* Вкладки-пилюли в одну строку с горизонтальной прокруткой (в 390 px все четыре не помещаются). */}
        <div role="tablist" aria-label="Списки дел" className="scroll-x -mx-4 flex gap-1.5 px-4 pt-2.5 pb-1">
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
                onClick={() => switchTab(t)}
                className={`relative min-h-9 shrink-0 rounded-full px-3.5 text-[14px] font-semibold whitespace-nowrap transition-colors duration-150 ${selected ? 'bg-ink text-bg' : 'text-muted'}`}
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
            {lists.counts.today === 0 && <Empty text={lists.doneToday.length ? 'На сегодня всё сделано' : 'На сегодня дел нет'} />}
            {lists.doneToday.length > 0 && (
              <Row onClick={() => switchTab('done')} className="card">
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
  return <p className="card px-4 py-5 text-center text-[14px] text-muted">{text}</p>;
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
