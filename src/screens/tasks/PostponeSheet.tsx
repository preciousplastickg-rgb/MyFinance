import { useState } from 'react';
import { useToday } from '../../app/nav';
import { addDays, formatShortDate, weekdayOf } from '../../domain/date';
import type { LocalDate, Task } from '../../domain/types';
import { Button, Field, TextInput } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';

/** «Перенести»: Завтра / Следующий понедельник / Выбрать / Убрать дату (SPEC 7.1). */
export function PostponeSheet({
  task,
  onPick,
  onDelete,
  onClose,
}: {
  task: Task;
  onPick: (date: LocalDate | undefined) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const today = useToday();
  const [custom, setCustom] = useState(task.date && task.date > today ? task.date : addDays(today, 2));
  const pick = (d: LocalDate | undefined) => {
    onPick(d);
    onClose();
  };
  const monday = addDays(today, 8 - weekdayOf(today));
  return (
    <Sheet title="Перенести" onClose={onClose}>
      <div className="space-y-4">
        <p className="truncate text-muted">{task.title}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => pick(addDays(today, 1))}>
            Завтра
          </Button>
          <Button variant="secondary" onClick={() => pick(monday)}>
            Пн, {formatShortDate(monday)}
          </Button>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Выбрать дату">{(id) => <TextInput id={id} type="date" value={custom} onChange={(e) => setCustom(e.target.value)} />}</Field>
          </div>
          <Button disabled={!/^\d{4}-\d{2}-\d{2}$/.test(custom)} onClick={() => pick(custom)}>
            Готово
          </Button>
        </div>
        <Button variant="secondary" className="w-full" onClick={() => pick(undefined)}>
          Убрать дату
        </Button>
        {onDelete && (
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            Удалить
          </Button>
        )}
      </div>
    </Sheet>
  );
}
