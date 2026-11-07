import { useEffect, useRef, useState } from 'react';
import { useToday } from '../../app/nav';
import { formatDayTitle, formatShortDate } from '../../domain/date';
import { BASE_CURRENCY, CURRENCIES } from '../../domain/currency';
import { minorToText, parseMoneyText } from '../../domain/money';
import { applyTaskChange } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { createTask, rescheduleTask } from '../../domain/tasks';
import type { Currency, Task, TaskRepeat } from '../../domain/types';
import { Button, Field, inputClass, Segmented, Switch, TextInput } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { IconPicker } from '../../ui/IconPicker';
import { Sheet } from '../../ui/Sheet';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
type RepeatKind = 'none' | TaskRepeat['type'];

/**
 * Карточка задачи: название, дата, время, повтор, сфера, свой значок, «Важно», заметка, удалить (SPEC 7.1).
 * isNew — то же окно для новой задачи по «+» в меню (этап 28): заголовок «Новая задача», кнопка «Добавить», без удаления;
 * task здесь — заготовка с датой по текущей вкладке.
 */
export function TaskCard({ task, onDelete, onClose, isNew = false }: { task: Task; onDelete?: () => void; onClose: () => void; isNew?: boolean }) {
  const { areas, goals } = useData();
  const today = useToday();
  const activeAreas = areas.filter((a) => !a.archived || a.id === task.areaId);
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(task.date ?? '');
  const [time, setTime] = useState(task.time ?? '');
  const [repeatKind, setRepeatKind] = useState<RepeatKind>(task.repeat?.type ?? 'none');
  const [weekdays, setWeekdays] = useState<number[]>(task.repeat?.type === 'weekly' ? task.repeat.weekdays : [1]);
  const [monthDay, setMonthDay] = useState(task.repeat?.type === 'monthly' ? task.repeat.day : 1);
  const [areaId, setAreaId] = useState(task.areaId ?? '');
  const [goalId, setGoalId] = useState(task.goalId ?? '');
  const [icon, setIcon] = useState<string | undefined>(task.icon);
  const [pickIcon, setPickIcon] = useState(false);
  const [important, setImportant] = useState(task.important);
  const [note, setNote] = useState(task.note ?? '');
  // Этап 29: дедлайн — к какому дню успеть; стоимость — сколько стоит дело, в любой валюте.
  const [deadline, setDeadline] = useState(task.deadline ?? '');
  const [costText, setCostText] = useState(task.cost ? minorToText(task.cost) : '');
  const [costCurrency, setCostCurrency] = useState<Currency>(task.costCurrency ?? BASE_CURRENCY);
  const titleRef = useRef<HTMLInputElement>(null);
  // Фокус в название после того, как окно забрало фокус себе (эффект Sheet срабатывает позже детского).
  useEffect(() => {
    if (!isNew) return;
    const t = setTimeout(() => titleRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [isNew]);

  const area = activeAreas.find((a) => a.id === areaId);
  const shownIcon = icon ?? area?.icon ?? 'CalendarCheck';
  const color = area?.color ?? 'blue';
  const repeat: TaskRepeat | undefined =
    repeatKind === 'daily' ? { type: 'daily' } : repeatKind === 'weekly' ? { type: 'weekly', weekdays } : repeatKind === 'monthly' ? { type: 'monthly', day: monthDay } : undefined;
  const cost = costText.trim() === '' ? undefined : parseMoneyText(costText);
  const costValid = cost === undefined || (cost !== null && cost >= 0);
  const valid = title.trim() !== '' && (repeatKind !== 'weekly' || weekdays.length > 0) && (!repeat || date !== '') && costValid;
  const extra = {
    deadline: deadline || undefined,
    cost: cost ? cost : undefined,
    costCurrency: cost ? costCurrency : undefined,
  };

  const save = async () => {
    if (isNew) {
      await applyTaskChange(
        createTask(
          {
            title, important, date: date || undefined, time: date && time ? time : undefined, repeat, areaId: areaId || undefined, goalId: goalId || undefined, icon, note: note.trim() || undefined,
            ...extra,
          },
          Date.now(),
        ),
      );
      onClose();
      return;
    }
    const moved = rescheduleTask(task, date || undefined, Date.now());
    const updated: Task = { ...moved.task, title: title.trim(), important };
    const optional = { time: date && time ? time : undefined, repeat, areaId: areaId || undefined, goalId: goalId || undefined, icon, note: note.trim() || undefined, ...extra };
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
      title={isNew ? 'Новая задача' : 'Задача'}
      onClose={onClose}
      full
      footer={
        <Button className="w-full" disabled={!valid} onClick={() => void save()}>
          {isNew ? 'Добавить' : 'Сохранить'}
        </Button>
      }
    >
      <div className="space-y-5 pt-1">
        <Field label="Название">
          {(id) => (
            <TextInput
              id={id}
              ref={titleRef}
              value={title}
              enterKeyHint="done"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && valid) void save();
              }}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата" hint={/^\d{4}-\d{2}-\d{2}$/.test(date) ? formatDayTitle(date, today) : date ? undefined : 'Попадёт во вкладку «Без даты»'}>
            {(id) => <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Время">
            {(id) => <TextInput id={id} type="time" value={time} disabled={!date} onChange={(e) => setTime(e.target.value)} />}
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Дедлайн" hint={/^\d{4}-\d{2}-\d{2}$/.test(deadline) ? `успеть до ${formatShortDate(deadline)}` : 'К какому дню успеть'}>
            {(id) => <TextInput id={id} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />}
          </Field>
          <Field label="Стоимость" hint={costValid ? undefined : 'Например, 1 500 или 12,50'}>
            {(id) => (
              <div className="flex min-w-0 gap-1.5">
                <TextInput id={id} inputMode="decimal" placeholder="0" value={costText} onChange={(e) => setCostText(e.target.value)} />
                <select aria-label="Валюта стоимости" className="block min-h-11 w-[76px] shrink-0 appearance-none rounded-ctl bg-sunk px-2 text-center text-[16px] text-ink outline-none focus:ring-2 focus:ring-accent" value={costCurrency} onChange={(e) => setCostCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </Field>
        </div>
        {deadline && (
          <Button variant="ghost" className="-mt-3 min-h-11 px-0" onClick={() => setDeadline('')}>
            Убрать дедлайн
          </Button>
        )}
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
                    className={`min-h-11 rounded-ctl text-caption font-semibold ${on ? 'bg-primary text-white' : 'bg-bg ring-1 ring-line'}`}
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
        {goals.some((g) => !g.archived) && (
          <Field label="Цель" hint="Дело ведёт к цели — считается в её прогрессе">
            {(id) => (
              <select id={id} className={select} value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                <option value="">Без цели</option>
                {goals
                  .filter((g) => !g.archived)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
              </select>
            )}
          </Field>
        )}
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
        <div className="flex items-center justify-between rounded-ctl bg-bg px-3.5 py-1">
          <p>Важно</p>
          <Switch checked={important} onChange={setImportant} label="Важно" />
        </div>
        <Field label="Заметка">
          {(id) => (
            <textarea id={id} rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} py-3`} />
          )}
        </Field>
        {!isNew && (
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              onDelete?.();
              onClose();
            }}
          >
            Удалить задачу
          </Button>
        )}
      </div>
    </Sheet>
  );
}
