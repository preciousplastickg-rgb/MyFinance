import { useMemo, useState } from 'react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { habitView, type HabitView } from '../../domain/habits';
import { Button, ListGroup } from '../../ui/controls';
import { HabitCard } from './HabitCard';
import { HabitDetail } from './HabitDetail';
import { HabitEditor } from './HabitEditor';

export function useHabitViews(includeArchived = false): HabitView[] {
  const { habits, habitLogs, workouts } = useData();
  const today = useToday();
  return useMemo(
    () => habits.filter((h) => includeArchived || !h.archived).map((h) => habitView(h, habitLogs, workouts, today)),
    [habits, habitLogs, workouts, today, includeArchived],
  );
}

/** Список привычек с отметками за сегодня. */
export function HabitList({ views }: { views: HabitView[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const current = views.find((v) => v.habit.id === open);
  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
        {views.map((v) => (
          <li key={v.habit.id}>
            <HabitCard view={v} onOpen={() => setOpen(v.habit.id)} />
          </li>
        ))}
      </ul>
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
      {active.length ? (
        <HabitList views={active} />
      ) : (
        <p className="rounded-2xl bg-surface p-5 text-center text-muted">
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
