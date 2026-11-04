import { useState } from 'react';
import { useToday } from '../../app/nav';
import { nextHabitOrder, saveHabit } from '../../data/habits';
import { PALETTE } from '../../domain/catalog';
import { HABIT_TEMPLATES } from '../../domain/habits';
import type { Habit } from '../../domain/types';
import { ColorPicker } from '../../ui/ColorPicker';
import { Button, Chip, Field, inputClass, Segmented, TextInput } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { IconPicker } from '../../ui/IconPicker';
import { Sheet } from '../../ui/Sheet';

const KIND_HINT: Record<Habit['kind'], string> = {
  daily: 'Галочка каждый день, считается серия дней подряд',
  weekly: 'Цель на неделю (пн–вс), например спортзал 3 раза',
  count: 'Сколько за день: «+1» на карточке, долгий тап — ввести число',
  abstain: 'Счётчик дней без срыва; срыв отмечается в меню «…»',
};

export function HabitEditor({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const today = useToday();
  const [name, setName] = useState(habit?.name ?? '');
  const [kind, setKind] = useState<Habit['kind']>(habit?.kind ?? 'daily');
  const [target, setTarget] = useState(String(habit?.target ?? (kind === 'count' ? 8 : 3)));
  const [unit, setUnit] = useState(habit?.unit ?? '');
  const [workoutType, setWorkoutType] = useState<Habit['workoutType'] | ''>(habit?.workoutType ?? '');
  const [color, setColor] = useState(habit?.color ?? PALETTE[0]);
  const [icon, setIcon] = useState(habit?.icon ?? 'Star');
  const [startDate, setStartDate] = useState(habit?.startDate ?? today);

  const targetNum = /^\d{1,5}$/.test(target.trim()) ? Number(target.trim()) : 0;
  const needsTarget = kind === 'weekly' || kind === 'count';
  const valid = name.trim() !== '' && (!needsTarget || (targetNum > 0 && (kind !== 'weekly' || targetNum <= 7)));

  const applyTemplate = (t: (typeof HABIT_TEMPLATES)[number]) => {
    setName(t.name);
    setKind(t.kind);
    setColor(t.color);
    setIcon(t.icon);
    setTarget(String(t.target ?? 3));
    setUnit(t.unit ?? '');
    setWorkoutType(t.workoutType ?? '');
  };

  const save = async () => {
    if (!valid) return;
    const next: Habit = {
      id: habit?.id ?? crypto.randomUUID(),
      name: name.trim(),
      icon,
      color,
      kind,
      startDate,
      sortOrder: habit?.sortOrder ?? (await nextHabitOrder()),
      archived: habit?.archived ?? false,
    };
    if (needsTarget) next.target = targetNum;
    if (kind === 'count' && unit.trim()) next.unit = unit.trim();
    if ((kind === 'daily' || kind === 'weekly') && workoutType) next.workoutType = workoutType;
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
            label="Тип привычки"
            value={kind}
            onChange={(k) => {
              setKind(k);
              if (k === 'count' && !habit) setTarget('8');
              if (k === 'weekly' && !habit) setTarget('3');
            }}
            options={[
              { value: 'daily', label: 'Каждый день' },
              { value: 'weekly', label: 'N в неделю' },
              { value: 'count', label: 'Сколько' },
              { value: 'abstain', label: 'Дни без' },
            ]}
          />
          <p className="text-caption text-muted">{KIND_HINT[kind]}</p>
        </div>
        {kind === 'weekly' && (
          <Field label="Раз в неделю">
            {(id) => (
              <select id={id} className={`${inputClass} appearance-none`} value={target} onChange={(e) => setTarget(e.target.value)}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        {kind === 'count' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Цель в день">{(id) => <TextInput id={id} inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} />}</Field>
            <Field label="Единица">{(id) => <TextInput id={id} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="стаканов" />}</Field>
          </div>
        )}
        {(kind === 'daily' || kind === 'weekly') && (
          <Field label="Засчитывать тренировки" hint="День с такой тренировкой отмечается сам">
            {(id) => (
              <select id={id} className={`${inputClass} appearance-none`} value={workoutType ?? ''} onChange={(e) => setWorkoutType(e.target.value as Habit['workoutType'] | '')}>
                <option value="">Нет</option>
                <option value="gym">Зал</option>
                <option value="pool">Бассейн</option>
                <option value="any">Любая тренировка</option>
              </select>
            )}
          </Field>
        )}
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
