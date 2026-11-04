import { useState } from 'react';
import { applyTaskChange } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { rescheduleTask } from '../../domain/tasks';
import type { Task, TaskRepeat } from '../../domain/types';
import { Button, Field, inputClass, Segmented, Switch, TextInput } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { IconPicker } from '../../ui/IconPicker';
import { Sheet } from '../../ui/Sheet';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
type RepeatKind = 'none' | TaskRepeat['type'];

/** Карточка задачи: название, дата, время, повтор, сфера, свой значок, «Важно», заметка, удалить (SPEC 7.1). */
export function TaskCard({ task, onDelete, onClose }: { task: Task; onDelete: () => void; onClose: () => void }) {
  const { areas } = useData();
  const activeAreas = areas.filter((a) => !a.archived || a.id === task.areaId);
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(task.date ?? '');
  const [time, setTime] = useState(task.time ?? '');
  const [repeatKind, setRepeatKind] = useState<RepeatKind>(task.repeat?.type ?? 'none');
  const [weekdays, setWeekdays] = useState<number[]>(task.repeat?.type === 'weekly' ? task.repeat.weekdays : [1]);
  const [monthDay, setMonthDay] = useState(task.repeat?.type === 'monthly' ? task.repeat.day : 1);
  const [areaId, setAreaId] = useState(task.areaId ?? '');
  const [icon, setIcon] = useState<string | undefined>(task.icon);
  const [pickIcon, setPickIcon] = useState(false);
  const [important, setImportant] = useState(task.important);
  const [note, setNote] = useState(task.note ?? '');

  const area = activeAreas.find((a) => a.id === areaId);
  const shownIcon = icon ?? area?.icon ?? 'CalendarCheck';
  const color = area?.color ?? '#2448D6';
  const repeat: TaskRepeat | undefined =
    repeatKind === 'daily' ? { type: 'daily' } : repeatKind === 'weekly' ? { type: 'weekly', weekdays } : repeatKind === 'monthly' ? { type: 'monthly', day: monthDay } : undefined;
  const valid = title.trim() !== '' && (repeatKind !== 'weekly' || weekdays.length > 0) && (!repeat || date !== '');

  const save = async () => {
    const moved = rescheduleTask(task, date || undefined, Date.now());
    const updated: Task = { ...moved.task, title: title.trim(), important };
    const optional = { time: date && time ? time : undefined, repeat, areaId: areaId || undefined, icon, note: note.trim() || undefined };
    for (const [k, v] of Object.entries(optional)) {
      if (v === undefined) delete (updated as unknown as Record<string, unknown>)[k];
      else (updated as unknown as Record<string, unknown>)[k] = v;
    }
    await applyTaskChange({ task: updated, events: moved.events });
    onClose();
  };

  const select = `${inputClass} appearance-none`;
  return (
    <Sheet
      title="Задача"
      onClose={onClose}
      full
      footer={
        <Button className="w-full" disabled={!valid} onClick={() => void save()}>
          Сохранить
        </Button>
      }
    >
      <div className="space-y-5 pt-1">
        <Field label="Название">{(id) => <TextInput id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата" hint={date ? undefined : 'Без даты — во Входящих'}>
            {(id) => <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Время">
            {(id) => <TextInput id={id} type="time" value={time} disabled={!date} onChange={(e) => setTime(e.target.value)} />}
          </Field>
        </div>
        {date && (
          <Button variant="ghost" className="-mt-3 min-h-11 px-0" onClick={() => (setDate(''), setTime(''), setRepeatKind('none'))}>
            Убрать дату
          </Button>
        )}
        <div className="space-y-3">
          <p className="text-caption text-muted">Повтор</p>
          <Segmented
            label="Повтор"
            value={repeatKind}
            onChange={setRepeatKind}
            options={[
              { value: 'none', label: 'Нет' },
              { value: 'daily', label: 'День' },
              { value: 'weekly', label: 'Неделя' },
              { value: 'monthly', label: 'Месяц' },
            ]}
          />
          {repeatKind === 'weekly' && (
            <div className="grid grid-cols-7 gap-1" role="group" aria-label="Дни недели">
              {WEEKDAYS.map((w, i) => {
                const on = weekdays.includes(i + 1);
                return (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setWeekdays(on ? weekdays.filter((d) => d !== i + 1) : [...weekdays, i + 1].sort())}
                    className={`min-h-11 rounded-xl text-caption font-semibold ${on ? 'bg-primary text-white' : 'bg-bg ring-1 ring-line'}`}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
          )}
          {repeatKind === 'monthly' && (
            <Field label="Число месяца">
              {(id) => (
                <select id={id} className={select} value={monthDay} onChange={(e) => setMonthDay(Number(e.target.value))}>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          {repeat && !date && <p className="text-caption text-warn">Для повтора нужна дата</p>}
        </div>
        <Field label="Сфера">
          {(id) => (
            <select id={id} className={select} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Без сферы</option>
              {activeAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <IconCircle name={shownIcon} color={color} size={44} />
            <div className="flex-1">
              <p>Значок</p>
              <p className="text-caption text-muted">{icon ? 'Свой' : 'Как у сферы'}</p>
            </div>
            {icon && (
              <Button variant="ghost" className="min-h-11 px-2" onClick={() => setIcon(undefined)}>
                Сбросить
              </Button>
            )}
            <Button variant="secondary" className="min-h-11" onClick={() => setPickIcon(!pickIcon)}>
              {pickIcon ? 'Скрыть' : 'Выбрать'}
            </Button>
          </div>
          {pickIcon && <IconPicker value={shownIcon} color={color} onChange={setIcon} />}
        </div>
        <div className="flex items-center justify-between rounded-xl bg-bg px-3.5 py-1">
          <p>Важно</p>
          <Switch checked={important} onChange={setImportant} label="Важно" />
        </div>
        <Field label="Заметка">
          {(id) => (
            <textarea id={id} rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} py-3`} />
          )}
        </Field>
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          Удалить задачу
        </Button>
      </div>
    </Sheet>
  );
}
