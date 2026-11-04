import { useMemo, useState } from 'react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { habitView, type HabitView } from '../../domain/habits';
import { Button, ListGroup } from '../../ui/controls';
import { HabitCard } from './HabitCard';
import { HabitDetail } from './HabitDetail';
import { HabitEditor } from './HabitEditor';

export function useHabitViews(includeArchived = false): HabitView[] {
  const { habits, habitLogs } = useData();
  const today = useToday();
  return useMemo(
    () => habits.filter((h) => includeArchived || !h.archived).map((h) => habitView(h, habitLogs, today)),
    [habits, habitLogs, today, includeArchived],
  );
}

/** Список привычек с отметками за сегодня. */
export function HabitList({ views, date }: { views: HabitView[]; date?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const current = views.find((v) => v.habit.id === open);
  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface">
        {views.map((v) => (
          <li key={v.habit.id}>
            <HabitCard view={v} date={date} onOpen={() => setOpen(v.habit.id)} />
          </li>
        ))}
      </ul>
      <p className="px-1 text-caption text-muted">Точки — последние 7 дней, крупная справа — {date ? 'этот день' : 'сегодня'}</p>
      {current && <HabitDetail view={current} onClose={() => setOpen(null)} />}
    </>
  );
}

/** «Дела → Привычки» (SPEC 7a). */
export function HabitsView() {
  const all = useHabitViews(true);
  const active = all.filter((v) => !v.habit.archived);
  const archived = all.filter((v) => v.habit.archived);
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <h2 className="px-1 pt-2 text-h2 font-semibold">Привычки</h2>
      {active.length ? (
        <HabitList views={active} />
      ) : (
        <p className="rounded-card bg-surface p-4 text-center text-muted">
          Привычек пока нет. Добавьте свою или возьмите шаблон: спортзал, бассейн, вода, чтение.
        </p>
      )}
      <Button variant="secondary" className="w-full" onClick={() => setAdding(true)}>
        Добавить привычку
      </Button>
      {archived.length > 0 && (
        <ListGroup title="Архив">
          <HabitList views={archived} />
        </ListGroup>
      )}
      {adding && <HabitEditor onClose={() => setAdding(false)} />}
    </div>
  );
}
