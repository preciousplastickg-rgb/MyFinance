import { useState, type ReactNode } from 'react';
import type { Task } from '../../domain/types';
import { DoneTaskSheet } from './DoneTaskSheet';
import { PostponeSheet } from './PostponeSheet';
import { TaskCard } from './TaskCard';
import { TaskRow } from './TaskRow';
import { useTaskActions } from './useTaskActions';

/** Группа задач с заголовком; открывает карточку и перенос. */
/** completed — все задачи группы показываются сделанными (повторяющиеся остаются open, но за этот день они сделаны). */
export function TaskGroup({
  title,
  titleClass = 'text-muted',
  tasks,
  swipe = true,
  completed = false,
  bare = false,
}: {
  title?: ReactNode;
  titleClass?: string;
  tasks: Task[];
  swipe?: boolean;
  completed?: boolean;
  /** Без своей карточки: заголовок и строки внутри общей карточки («Дела» на «Сегодня»). */
  bare?: boolean;
}) {
  const actions = useTaskActions();
  const [card, setCard] = useState<Task | null>(null);
  const [viewing, setViewing] = useState<Task | null>(null);
  const [postpone, setPostpone] = useState<Task | null>(null);
  if (!tasks.length) return null;
  const Wrap = bare ? 'div' : 'section';
  return (
    <Wrap className={bare ? '' : 'space-y-2'}>
      {title && <h2 className={`${bare ? 'px-4 pt-1.5 pb-0.5' : 'px-1'} text-caption font-semibold ${titleClass}`}>{title}</h2>}
      <ul className={bare ? '' : 'card divide-y divide-line overflow-hidden py-1.5'}>
        {tasks.map((t) => (
          <li key={t.id}>
            <TaskRow
              task={t}
              swipe={swipe}
              done={completed || t.status === 'done'}
              onToggle={() => actions.complete(t)}
              // Выполненную тап только открывает — вернуть в работу можно кнопкой в карточке (этап 19).
              onOpen={() => (completed || t.status === 'done' ? setViewing(t) : setCard(t))}
              onPostpone={() => setPostpone(t)}
              onDelete={() => actions.remove(t)}
            />
          </li>
        ))}
      </ul>
      {card && <TaskCard task={card} onDelete={() => actions.remove(card)} onClose={() => setCard(null)} />}
      {viewing && (
        <DoneTaskSheet task={viewing} onReopen={() => actions.reopen(viewing)} onDelete={() => actions.remove(viewing)} onClose={() => setViewing(null)} />
      )}
      {postpone && (
        <PostponeSheet task={postpone} onPick={(d) => actions.reschedule(postpone, d)} onClose={() => setPostpone(null)} />
      )}
    </Wrap>
  );
}
