import { CheckCircle2, Flag } from 'lucide-react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { formatDayTitle, formatTime, toLocalDate } from '../../domain/date';
import { describeRepeat } from '../../domain/tasks';
import type { Task } from '../../domain/types';
import { Button } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';

/**
 * Выполненная задача — только просмотр (этап 19): когда сделана, что было запланировано, сфера, заметка.
 * Вернуть в работу — отдельной кнопкой, чтобы случайный тап ничего не менял.
 */
export function DoneTaskSheet({ task, onReopen, onDelete, onClose }: { task: Task; onReopen: () => void; onDelete: () => void; onClose: () => void }) {
  const { areas } = useData();
  const today = useToday();
  const area = task.areaId ? areas.find((a) => a.id === task.areaId) : undefined;
  const rows: [string, string][] = [];
  if (task.date) rows.push(['Была запланирована', `${formatDayTitle(task.date, today)}${task.time ? `, ${task.time}` : ''}`]);
  if (task.repeat) rows.push(['Повтор', describeRepeat(task.repeat)]);
  if (area) rows.push(['Сфера', area.name]);
  if (task.postponeCount > 0) rows.push(['Переносилась', `${task.postponeCount} раз`]);

  return (
    <Sheet title="Выполнено" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <IconCircle name={task.icon ?? area?.icon ?? 'CalendarCheck'} color={area?.color ?? '#0B7A4B'} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-h2 font-semibold">
              {task.title}
              {task.important && <Flag size={16} className="ml-1.5 inline fill-warn text-warn" aria-label="Важно" />}
            </p>
            {task.doneAt !== undefined && (
              <p className="flex items-center gap-1 text-caption font-medium text-income">
                <CheckCircle2 size={14} aria-hidden />
                {formatDayTitle(toLocalDate(task.doneAt), today)}, {formatTime(task.doneAt)}
              </p>
            )}
          </div>
        </div>
        {rows.length > 0 && (
          <dl className="divide-y divide-line overflow-hidden rounded-card bg-bg">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 px-4 py-2.5">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {task.note && <p className="rounded-card bg-bg px-4 py-3 whitespace-pre-wrap">{task.note}</p>}
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            onReopen();
            onClose();
          }}
        >
          Вернуть в работу
        </Button>
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          Удалить задачу
        </Button>
      </div>
    </Sheet>
  );
}
