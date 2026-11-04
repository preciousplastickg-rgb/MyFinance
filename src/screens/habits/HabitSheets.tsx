import { useState } from 'react';
import { setHabitValue, toggleHabitDay } from '../../data/habits';
import { formatRelativeDate } from '../../domain/date';
import type { HabitView } from '../../domain/habits';
import type { LocalDate } from '../../domain/types';
import { useToday } from '../../app/nav';
import { Button, Field, TextInput } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';

/** Количество за день — ввести число (долгий тап по «+1» или день в календаре). */
export function CountSheet({ view, date, onClose }: { view: HabitView; date: LocalDate; onClose: () => void }) {
  const today = useToday();
  const [text, setText] = useState(String(view.value(date)));
  const value = /^\d{1,5}$/.test(text.trim()) ? Number(text.trim()) : null;
  return (
    <Sheet title={view.habit.name} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (value === null) return;
          void setHabitValue(view.habit.id, date, value).then(onClose);
        }}
      >
        <Field label={`${formatRelativeDate(date, today)}, цель ${view.habit.target ?? 1}${view.habit.unit ? ` ${view.habit.unit}` : ''}`}>
          {(id) => <TextInput id={id} autoFocus inputMode="numeric" value={text} onChange={(e) => setText(e.target.value)} />}
        </Field>
        <Button type="submit" className="w-full" disabled={value === null}>
          Сохранить
        </Button>
      </form>
    </Sheet>
  );
}

/** «Дни без…»: срыв ставится только с подтверждением (SPEC 7a.1). */
export function RelapseSheet({ view, date, onClose }: { view: HabitView; date: LocalDate; onClose: () => void }) {
  const today = useToday();
  const relapsed = view.state(date) === 'relapse';
  return (
    <Sheet title={view.habit.name} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-muted">
          {relapsed
            ? `${formatRelativeDate(date, today)} отмечен срыв.`
            : `Отметить срыв ${formatRelativeDate(date, today).toLowerCase()}? Счётчик дней начнётся заново.`}
        </p>
        <Button variant={relapsed ? 'secondary' : 'danger'} className="w-full" onClick={() => void toggleHabitDay(view.habit.id, date).then(onClose)}>
          {relapsed ? 'Убрать срыв' : 'Да, был срыв'}
        </Button>
      </div>
    </Sheet>
  );
}
