import { useState, type ReactNode } from 'react';
import type { Task } from '../../domain/types';
import { PostponeSheet } from './PostponeSheet';
import { TaskCard } from './TaskCard';
import { TaskRow } from './TaskRow';
import { useTaskActions } from './useTaskActions';

/** Группа задач с заголовком; открывает карточку и перенос. */
export function TaskGroup({ title, titleClass = 'text-muted', tasks, swipe = true }: { title?: ReactNode; titleClass?: string; tasks: Task[]; swipe?: boolean }) {
  const actions = useTaskActions();
  const [card, setCard] = useState<Task | null>(null);
  const [postpone, setPostpone] = useState<Task | null>(null);
  if (!tasks.length) return null;
  return (
    <section className="space-y-2">
      {title && <h2 className={`px-1 text-caption font-semibold ${titleClass}`}>{title}</h2>}
      <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface">
        {tasks.map((t) => (
          <li key={t.id}>
            <TaskRow
              task={t}
              swipe={swipe}
              onToggle={() => (t.status === 'done' ? actions.reopen(t) : actions.complete(t))}
              onOpen={() => (t.status === 'done' ? actions.reopen(t) : setCard(t))}
              onPostpone={() => setPostpone(t)}
              onDelete={() => actions.remove(t)}
            />
          </li>
        ))}
      </ul>
      {card && <TaskCard task={card} onDelete={() => actions.remove(card)} onClose={() => setCard(null)} />}
      {postpone && (
        <PostponeSheet task={postpone} onPick={(d) => actions.reschedule(postpone, d)} onClose={() => setPostpone(null)} />
      )}
    </section>
  );
}
