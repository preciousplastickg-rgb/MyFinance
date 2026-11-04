import { useToday } from '../../app/nav';
import { applyTaskChange } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { formatShortDate } from '../../domain/date';
import { completeTask, deleteTask, rescheduleTask, undoComplete } from '../../domain/tasks';
import type { LocalDate, Task } from '../../domain/types';
import { useToast } from '../../ui/Toast';

/** Действия с задачей: выполнить с отменой 5 с, отменить выполнение, перенести, удалить (SPEC 7.2). */
export function useTaskActions() {
  const { taskEvents } = useData();
  const toast = useToast();
  const today = useToday();

  const complete = (task: Task) => {
    const change = completeTask(task, Date.now());
    void applyTaskChange(change);
    const done = change.events[0]!;
    toast({
      message: task.repeat && change.task.date ? `Сделано · следующий раз ${formatShortDate(change.task.date)}` : 'Сделано',
      actionLabel: 'Отменить',
      onAction: () => void applyTaskChange(undoComplete(task, done, Date.now())),
    });
  };

  /** Тап по зачёркнутой задаче до конца дня — вернуть в работу. */
  const reopen = (task: Task) => {
    const done = [...taskEvents].filter((e) => e.taskId === task.id && e.type === 'done').sort((a, b) => b.at - a.at)[0];
    const before: Task = { ...task, status: 'open' };
    delete before.doneAt;
    void applyTaskChange(undoComplete(before, done ?? { id: '', taskId: task.id, type: 'done', date: today, at: 0 }, Date.now()));
  };

  const reschedule = (task: Task, date: LocalDate | undefined) => void applyTaskChange(rescheduleTask(task, date, Date.now()));

  const remove = (task: Task) => {
    void applyTaskChange(deleteTask(task, Date.now()));
    toast({ message: 'Задача удалена', actionLabel: 'Отменить', onAction: () => void applyTaskChange({ task, events: [] }) });
  };

  return { complete, reopen, reschedule, remove };
}
