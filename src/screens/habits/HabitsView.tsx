import { useMemo, useState } from 'react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { habitView, type HabitView } from '../../domain/habits';
import { reorder } from '../../data/actions';
import { Button, ListGroup } from '../../ui/controls';
import { SortableList } from '../../ui/SortableList';
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

/** Список привычек с отметками за неделю. onReorder — порядок можно менять перетаскиванием за ручку. */
export function HabitList({ views, date, onReorder }: { views: HabitView[]; date?: string; onReorder?: (ids: string[]) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const current = views.find((v) => v.habit.id === open);
  const items = views.map((v) => ({ id: v.habit.id, v }));
  return (
    <>
      {onReorder ? (
        <SortableList
          items={items}
          inlineHandle
          itemLabel={(i) => i.v.habit.name}
          onReorder={onReorder}
          renderItem={(i, handle) => <HabitCard view={i.v} date={date} onOpen={() => setOpen(i.id)} handle={handle} />}
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface">
          {views.map((v) => (
            <li key={v.habit.id}>
              <HabitCard view={v} date={date} onOpen={() => setOpen(v.habit.id)} />
            </li>
          ))}
        </ul>
      )}
      <p className="px-1 text-caption text-muted">
        Тап по дню недели ставит или снимает галочку{onReorder ? '. Порядок — перетащите за ⋮⋮ справа' : ''}
      </p>
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
        <HabitList views={active} onReorder={(ids) => void reorder('habits', [...ids, ...archived.map((v) => v.habit.id)])} />
      ) : (
        <p className="rounded-card bg-surface p-4 text-center text-muted">
          Привычек пока нет. Добавьте свою или возьмите шаблон: спортзал, вода, чтение, медитация.
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
