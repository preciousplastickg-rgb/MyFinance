import { describe, expect, it } from 'vitest';
import {
  badgeText, completeTask, createTask, deleteTask, describeRepeat, nextRepeatDate, periodRange, periodStats, rescheduleTask,
  homeTasks, stalledTasks, taskLists, taskWarning, undoComplete,
} from './tasks';
import type { Task, TaskEvent } from './types';

const at = (date: string, time = '10:00') => Date.parse(`${date}T${time}:00+06:00`);
const TODAY = '2026-11-04';
const NOW = at(TODAY);

function make(fields: Partial<Task> & { title?: string } = {}, created = NOW): { task: Task; events: TaskEvent[] } {
  const { task, events } = createTask({ title: fields.title ?? 'Задача', ...fields }, created);
  return { task: { ...task, ...fields }, events };
}

describe('перенос (SPEC 7.2)', () => {
  it('на более позднюю дату — postponeCount++ и событие', () => {
    const { task } = make({ date: TODAY });
    const r = rescheduleTask(task, '2026-11-05', NOW);
    expect(r.task.postponeCount).toBe(1);
    expect(r.events).toMatchObject([{ type: 'postponed', fromDate: TODAY, toDate: '2026-11-05', date: TODAY }]);
  });
  it('снятие даты — тоже перенос, время сбрасывается', () => {
    const { task } = make({ date: TODAY, time: '09:00' });
    const r = rescheduleTask(task, undefined, NOW);
    expect(r.task.date).toBeUndefined();
    expect(r.task.time).toBeUndefined();
    expect(r.task.postponeCount).toBe(1);
  });
  it('на более раннюю дату и задаче без даты — не перенос', () => {
    const { task } = make({ date: '2026-11-10' });
    expect(rescheduleTask(task, '2026-11-05', NOW)).toMatchObject({ task: { postponeCount: 0 }, events: [] });
    const inbox = make().task;
    expect(rescheduleTask(inbox, '2026-11-05', NOW)).toMatchObject({ task: { date: '2026-11-05', postponeCount: 0 }, events: [] });
  });
  it('задача, перенесённая 3 раза, попадает в «Откладывается» (приёмка этапа 8)', () => {
    let { task } = make({ date: TODAY });
    for (const d of ['2026-11-05', '2026-11-06', '2026-11-09']) task = rescheduleTask(task, d, NOW).task;
    expect(task.postponeCount).toBe(3);
    expect(stalledTasks([task], TODAY)).toEqual([task]);
    expect(taskWarning(task, TODAY)).toBe('Перенесено 3 раза');
  });
});

describe('выполнение', () => {
  it('обычная — done и doneAt', () => {
    const { task } = make({ date: TODAY });
    const r = completeTask(task, NOW);
    expect(r.task).toMatchObject({ status: 'done', doneAt: NOW });
    expect(r.events).toMatchObject([{ type: 'done', date: TODAY }]);
  });
  it('повторяющаяся — done с текущей date, дата сдвигается, postponeCount обнуляется', () => {
    const { task } = make({ date: '2026-11-03', repeat: { type: 'daily' }, postponeCount: 2 });
    const r = completeTask(task, NOW);
    expect(r.task).toMatchObject({ status: 'open', date: '2026-11-05', postponeCount: 0 });
    expect(r.events).toMatchObject([{ type: 'done', date: '2026-11-03' }]);
  });
  it('отмена — undone с датой отменённого done', () => {
    const { task } = make({ date: TODAY });
    const done = completeTask(task, NOW);
    const undo = undoComplete(task, done.events[0]!, NOW + 1000);
    expect(undo.task).toEqual(task);
    expect(undo.events).toMatchObject([{ type: 'undone', date: TODAY }]);
  });
});

describe('повторы', () => {
  it('nextRepeatDate', () => {
    expect(nextRepeatDate({ type: 'daily' }, '2026-12-31')).toBe('2027-01-01');
    expect(nextRepeatDate({ type: 'weekly', weekdays: [1, 3] }, '2026-11-04')).toBe('2026-11-09');
    expect(nextRepeatDate({ type: 'weekly', weekdays: [5] }, '2026-11-04')).toBe('2026-11-06');
    expect(nextRepeatDate({ type: 'monthly', day: 31 }, '2026-11-04')).toBe('2026-11-30');
    expect(nextRepeatDate({ type: 'monthly', day: 31 }, '2027-01-31')).toBe('2027-02-28');
    expect(nextRepeatDate({ type: 'monthly', day: 4 }, '2026-11-04')).toBe('2026-12-04');
  });
  it('describeRepeat', () => {
    expect(describeRepeat({ type: 'daily' })).toBe('каждый день');
    expect(describeRepeat({ type: 'weekly', weekdays: [1, 2, 3, 4, 5] })).toBe('по будням');
    expect(describeRepeat({ type: 'weekly', weekdays: [3, 1] })).toBe('пн, ср');
    expect(describeRepeat({ type: 'monthly', day: 10 })).toBe('каждое 10-е');
  });
});

describe('списки', () => {
  const tasks = [
    make({ title: 'просрочена', date: '2026-11-02' }, at('2026-11-01')).task,
    make({ title: 'днём', date: TODAY, time: '14:00' }).task,
    make({ title: 'утром', date: TODAY, time: '09:00' }).task,
    make({ title: 'без времени', date: TODAY }).task,
    make({ title: 'завтра', date: '2026-11-05' }).task,
    make({ title: 'через 40 дней', date: '2026-12-14' }).task,
    make({ title: 'старая во входящих' }, at('2026-10-15')).task,
    make({ title: 'новая во входящих' }, NOW + 1).task,
    { ...make({ title: 'сделана сегодня', date: TODAY }).task, status: 'done' as const, doneAt: NOW },
    { ...make({ title: 'удалена', date: TODAY }).task, status: 'deleted' as const },
  ];
  const l = taskLists(tasks, TODAY);
  it('Сегодня: просроченные, затем по времени, без времени в конце', () => {
    expect(l.overdue.map((t) => t.title)).toEqual(['просрочена']);
    expect(l.today.map((t) => t.title)).toEqual(['утром', 'днём', 'без времени']);
    expect(l.doneToday.map((t) => t.title)).toEqual(['сделана сегодня']);
  });
  it('«Выполненные»: по дню выполнения, новые сверху', () => {
    const earlier = { ...make({ title: 'сделана вчера' }).task, status: 'done' as const, doneAt: NOW - 86_400_000 };
    const later = { ...make({ title: 'сделана сегодня позже' }).task, status: 'done' as const, doneAt: NOW + 60_000 };
    const d = taskLists([...tasks, earlier, later], TODAY).done;
    expect(d.map((g) => g.date)).toEqual([TODAY, '2026-11-03']);
    expect(d[0]!.tasks.map((t) => t.title)).toEqual(['сделана сегодня позже', 'сделана сегодня']);
    expect(d[1]!.tasks.map((t) => t.title)).toEqual(['сделана вчера']);
  });
  it('Предстоящие на 30 дней и «Позже», «Без даты» — новые сверху', () => {
    expect(l.upcoming).toMatchObject([{ date: '2026-11-05', tasks: [{ title: 'завтра' }] }]);
    expect(l.later.map((t) => t.title)).toEqual(['через 40 дней']);
    expect(l.inbox.map((t) => t.title)).toEqual(['новая во входящих', 'старая во входящих']);
  });
  it('блок на «Сегодня»: сегодня с просроченными и завтра', () => {
    const h = homeTasks(l, TODAY);
    expect(h.today.map((t) => t.title)).toEqual(['просрочена', 'утром', 'днём', 'без времени']);
    expect(h.tomorrow.map((t) => t.title)).toEqual(['завтра']);
    expect(h).toMatchObject({ todayMore: 0, tomorrowMore: 0 });
  });
  it('счётчики и бейджи', () => {
    expect(l.counts).toEqual({ today: 4, upcoming: 2, inbox: 2, overdue: 1 });
    expect([0, 5, 99, 100].map(badgeText)).toEqual([null, '5', '99', '99+']);
  });
  it('предупреждение «Без даты уже N дней» при возрасте ≥ 14 дней', () => {
    expect(taskWarning(l.inbox[1]!, TODAY)).toBe('Без даты уже 20 дней');
    expect(taskWarning(l.inbox[0]!, TODAY)).toBeNull();
    expect(stalledTasks(tasks, TODAY).map((t) => t.title)).toEqual(['старая во входящих']);
  });
});

describe('блок дел на «Сегодня»: не больше 6 за два дня', () => {
  const TOMORROW = '2026-11-05';
  const tasks = (n: number, date: string, important: number[] = []) =>
    Array.from({ length: n }, (_, i) => make({ title: `${date === TODAY ? 'с' : 'з'}${i + 1}`, date, important: important.includes(i + 1) }, NOW + i).task);
  const home = (today: Task[], tomorrow: Task[]) => {
    const h = homeTasks(taskLists([...today, ...tomorrow], TODAY), TODAY);
    return [h.today.map((t) => t.title), h.tomorrow.map((t) => t.title), h.todayMore, h.tomorrowMore];
  };
  it('завтра пусто — до 6 сегодняшних', () => {
    expect(home(tasks(5, TODAY), [])).toEqual([['с1', 'с2', 'с3', 'с4', 'с5'], [], 0, 0]);
    expect(home(tasks(8, TODAY), [])[2]).toBe(2);
  });
  it('оба дня заняты — по 3, важные первыми', () => {
    expect(home(tasks(5, TODAY, [4]), tasks(4, TOMORROW, [3]))).toEqual([['с4', 'с1', 'с2'], ['з3', 'з1', 'з2'], 2, 1]);
  });
  it('на один день меньше 3 — места отдаются другому', () => {
    expect(home(tasks(1, TODAY), tasks(8, TOMORROW))).toEqual([['с1'], ['з1', 'з2', 'з3', 'з4', 'з5'], 0, 3]);
    expect(home([], tasks(7, TOMORROW))).toEqual([[], ['з1', 'з2', 'з3', 'з4', 'з5', 'з6'], 0, 1]);
  });
});

describe('статистика', () => {
  it('неделя пн–вс и месяц', () => {
    expect(periodRange('week', TODAY)).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(periodRange('month', TODAY)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  });

  it('запланировано — задачи, у которых когда-либо была дата D; сделано — done без последующего undone', () => {
    const events: TaskEvent[] = [];
    const tasks: Task[] = [];
    const keep = (c: { task: Task; events: TaskEvent[] }) => {
      const i = tasks.findIndex((t) => t.id === c.task.id);
      if (i >= 0) tasks[i] = c.task;
      else tasks.push(c.task);
      events.push(...c.events);
      return c.task;
    };
    const a = keep(createTask({ title: 'A', date: '2026-11-02', areaId: 'work' }, at('2026-11-02', '08:00')));
    keep(completeTask(a, at('2026-11-02', '18:00')));
    const b = keep(createTask({ title: 'B', date: '2026-11-02', areaId: 'work' }, at('2026-11-02', '08:00')));
    keep(rescheduleTask(b, '2026-11-03', at('2026-11-02', '20:00'))); // запланирована и на 2-е, и на 3-е
    const c = keep(createTask({ title: 'C', date: '2026-11-03' }, at('2026-11-02', '08:00')));
    const cDone = keep(completeTask(c, at('2026-11-03', '12:00')));
    keep(undoComplete(c, events[events.length - 1]!, at('2026-11-03', '12:05'))); // отменено — не считается
    void cDone;
    const d = keep(createTask({ title: 'D', date: '2026-11-03' }, at('2026-11-02', '08:00')));
    keep(deleteTask(d, at('2026-11-02', '09:00'))); // удалённая не считается

    const s = periodStats('week', TODAY, TODAY, tasks, events);
    expect(s.bars.slice(0, 3).map((b) => [b.label, b.planned, b.done])).toEqual([['Пн', 2, 1], ['Вт', 2, 0], ['Ср', 0, 0]]);
    expect(s.bars[2]!.today).toBe(true);
    expect([s.done, s.planned]).toEqual([1, 4]);
    expect(s.second).toEqual({ label: 'Осталось', value: 0 });
    expect(s.overdue).toBe(2); // B и C открыты с датой 3-го
    expect(s.areas).toMatchObject([{ areaId: 'work', planned: 2, done: 1 }, { areaId: undefined, planned: 1, done: 0 }]);
    // За плитками и сферами — сами задачи, чтобы открыть их из отчёта.
    expect(s.areas[0]!.tasks.map((t) => t.title).sort()).toEqual(['A', 'B']);
    expect(s.lists.done.map((t) => t.title)).toEqual(['A']);
    expect(s.lists.done).toHaveLength(s.done);
    expect(s.lists.overdue).toHaveLength(s.overdue);

    const past = periodStats('week', '2026-11-03', '2026-11-20', tasks, events);
    expect(past.current).toBe(false);
    expect(past.second).toEqual({ label: 'Перенесено', value: 1 });
  });

  it('месяц — столбцы по неделям', () => {
    const s = periodStats('month', TODAY, TODAY, [], []);
    expect(s.bars.map((b) => b.label)).toEqual(['1–1', '2–8', '9–15', '16–22', '23–29', '30–30']);
  });
});
