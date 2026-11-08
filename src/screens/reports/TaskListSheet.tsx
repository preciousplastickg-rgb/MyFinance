import { useData } from '../../data/DataProvider';
import type { Id, Task } from '../../domain/types';
import { Sheet } from '../../ui/Sheet';
import { TaskGroup } from '../tasks/TaskList';

/** Задачи за плиткой или сферой отчёта: отметить, открыть карточку, перенести (этап 18). */
export function TaskListSheet({
  title,
  subtitle,
  tasks: snapshot,
  doneIds,
  onClose,
}: {
  title: string;
  subtitle?: string;
  tasks: Task[];
  /** Сделанные за период по журналу — повторяющиеся задачи остаются open, но здесь они «сделаны». */
  doneIds?: ReadonlySet<Id>;
  onClose: () => void;
}) {
  // Список — по id из отчёта, состояние — свежее: отметили в окне — строка сразу переезжает.
  const { tasks: all } = useData();
  const byId = new Map(all.map((t) => [t.id, t]));
  const tasks = snapshot.map((t) => byId.get(t.id) ?? t).filter((t) => t.status !== 'deleted');
  const isDone = (t: Task) => t.status === 'done' || !!doneIds?.has(t.id);
  const open = tasks.filter((t) => !isDone(t));
  const done = tasks.filter(isDone);
  return (
    <Sheet title={title} onClose={onClose} full>
      <div className="space-y-4">
        {subtitle && <p className="text-caption text-muted">{subtitle}</p>}
        <TaskGroup title={done.length ? 'В работе' : undefined} tasks={open} />
        <TaskGroup title={open.length ? 'Сделано' : undefined} tasks={done} swipe={false} completed />
        {tasks.length === 0 && <p className="py-5 text-center text-sub text-muted">Задач нет</p>}
      </div>
    </Sheet>
  );
}
