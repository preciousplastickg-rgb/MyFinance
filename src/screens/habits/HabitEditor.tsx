import { useState } from 'react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { nextHabitOrder, saveHabit } from '../../data/habits';
import { PALETTE } from '../../domain/catalog';
import { HABIT_TEMPLATES, isEveryDay } from '../../domain/habits';
import type { Habit } from '../../domain/types';
import { ColorPicker } from '../../ui/ColorPicker';
import { Button, Chip, Field, inputClass, Segmented, TextInput } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { IconPicker } from '../../ui/IconPicker';
import { Sheet } from '../../ui/Sheet';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Привычка — просто галочка за день; расписание — каждый день или выбранные дни недели (SPEC 7a.1). */
export function HabitEditor({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const today = useToday();
  const { goals, categories } = useData();
  const [name, setName] = useState(habit?.name ?? '');
  const [goalId, setGoalId] = useState(habit?.goalId ?? '');
  const [watchCategoryId, setWatchCategoryId] = useState(habit?.watchCategoryId ?? '');
  const [days, setDays] = useState<number[]>(habit && !isEveryDay(habit) ? [...habit.days!] : []);
  const [everyDay, setEveryDay] = useState(!habit || isEveryDay(habit));
  const [note, setNote] = useState(habit?.note ?? '');
  const [color, setColor] = useState(habit?.color ?? PALETTE[0]);
  const [icon, setIcon] = useState(habit?.icon ?? 'Star');
  const [startDate, setStartDate] = useState(habit?.startDate ?? today);

  const valid = name.trim() !== '' && (everyDay || days.length > 0);

  const applyTemplate = (t: (typeof HABIT_TEMPLATES)[number]) => {
    setName(t.name);
    setColor(t.color);
    setIcon(t.icon);
    setNote(t.note ?? '');
    setEveryDay(!t.days);
    setDays(t.days ? [...t.days] : []);
  };

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b)));

  const save = async () => {
    if (!valid) return;
    // Старые поля (kind, legacyKind, target, unit, workoutType) сохраняем как есть — ничего не удаляем из данных.
    const next: Habit = {
      ...habit,
      id: habit?.id ?? crypto.randomUUID(),
      name: name.trim(),
      icon,
      color,
      kind: 'daily',
      startDate,
      sortOrder: habit?.sortOrder ?? (await nextHabitOrder()),
      archived: habit?.archived ?? false,
    };
    if (everyDay || days.length === 7) delete next.days;
    else next.days = days;
    if (goalId) next.goalId = goalId;
    else delete next.goalId;
    if (watchCategoryId) next.watchCategoryId = watchCategoryId;
    else delete next.watchCategoryId;
    if (note.trim()) next.note = note.trim();
    else delete next.note;
    await saveHabit(next);
    onClose();
  };

  return (
    <Sheet
      title={habit ? 'Привычка' : 'Новая привычка'}
      onClose={onClose}
      full
      footer={
        <Button className="w-full" disabled={!valid} onClick={() => void save()}>
          Сохранить
        </Button>
      }
    >
      <div className="space-y-5 pt-1">
        {!habit && (
          <div className="flex flex-wrap gap-2" aria-label="Шаблоны">
            {HABIT_TEMPLATES.map((t) => (
              <Chip key={t.name} onClick={() => applyTemplate(t)}>
                <IconCircle name={t.icon} color={t.color} size={22} />
                {t.name}
              </Chip>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <IconCircle name={icon} color={color} size={56} />
          <div className="min-w-0 flex-1">
            <Field label="Название">{(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Зарядка" />}</Field>
          </div>
        </div>
        <div className="space-y-2">
          <Segmented
            label="Расписание"
            value={everyDay ? 'every' : 'days'}
            onChange={(v) => setEveryDay(v === 'every')}
            options={[
              { value: 'every', label: 'Каждый день' },
              { value: 'days', label: 'По дням недели' },
            ]}
          />
          {!everyDay && (
            <div className="grid grid-cols-7 gap-1" role="group" aria-label="Дни недели">
              {WEEKDAYS.map((w, i) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={days.includes(i + 1)}
                  onClick={() => toggleDay(i + 1)}
                  className={`min-h-11 rounded-ctl text-body font-medium ${days.includes(i + 1) ? 'bg-primary text-white' : 'bg-surface text-ink ring-1 ring-line'}`}
                >
                  {w}
                </button>
              ))}
            </div>
          )}
          <p className="text-caption text-muted">
            {everyDay ? 'Галочка каждый день, серия — дни подряд' : days.length ? 'В другие дни галочку не ждём, но поставить её можно' : 'Выберите хотя бы один день'}
          </p>
        </div>
        {goals.some((g) => !g.archived) && (
          <Field label="Цель" hint="Привычка ведёт к цели — её % входит в прогресс">
            {(id) => (
              <select id={id} className={`${inputClass} appearance-none`} value={goalId} onChange={(e) => setGoalId(e.target.value)}>
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
        <Field label="Следить за тратами в категории" hint="Для привычек вроде «Без кафе»: если сегодня есть трата в этой категории — предупреждение">
          {(id) => (
            <select id={id} className={`${inputClass} appearance-none`} value={watchCategoryId} onChange={(e) => setWatchCategoryId(e.target.value)}>
              <option value="">Не следить</option>
              {categories
                .filter((c) => c.kind === 'expense' && !c.archived)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          )}
        </Field>
        <Field label="Подпись (необязательно)">
          {(id) => <TextInput id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например, 3 литра" />}
        </Field>
        <Field label="Начало" hint="Серии и проценты считаются с этой даты">
          {(id) => <TextInput id={id} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}
        </Field>
        <Field label="Цвет">{() => <ColorPicker value={color} onChange={setColor} />}</Field>
        <Field label="Значок">{() => <IconPicker value={icon} color={color} onChange={setIcon} />}</Field>
        {habit && (
          <Button variant="danger" className="w-full" onClick={() => void saveHabit({ ...habit, archived: !habit.archived }).then(onClose)}>
            {habit.archived ? 'Вернуть из архива' : 'В архив'}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
