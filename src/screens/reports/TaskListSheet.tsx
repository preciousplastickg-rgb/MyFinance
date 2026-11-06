import { useData } from '../../data/DataProvider';
import type { Task } from '../../domain/types';
import { Sheet } from '../../ui/Sheet';
import { TaskGroup } from '../tasks/TaskList';

/** Задачи за плиткой или сферой отчёта: отметить, открыть карточку, перенести (этап 18). */
export function TaskListSheet({ title, subtitle, tasks: snapshot, onClose }: { title: string; subtitle?: string; tasks: Task[]; onClose: () => void }) {
  // Список — по id из отчёта, состояние — свежее: отметили в окне — строка сразу переезжает.
  const { tasks: all } = useData();
  const byId = new Map(all.map((t) => [t.id, t]));
  const tasks = snapshot.map((t) => byId.get(t.id) ?? t).filter((t) => t.status !== 'deleted');
  const open = tasks.filter((t) => t.status === 'open');
  const done = tasks.filter((t) => t.status === 'done');
  return (
    <Sheet title={title} onClose={onClose} full>
      <div className="space-y-4">
        {subtitle && <p className="text-caption text-muted">{subtitle}</p>}
        <TaskGroup title={done.length ? 'В работе' : undefined} tasks={open} />
        <TaskGroup title={open.length ? 'Сделано' : undefined} tasks={done} swipe={false} />
        {tasks.length === 0 && <p className="py-6 text-center text-muted">Задач нет</p>}
      </div>
    </Sheet>
  );
}
