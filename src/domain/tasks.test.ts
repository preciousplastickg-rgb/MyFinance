import { describe, expect, it } from 'vitest';
import {
  badgeText, burnupCaption, completeTask, createTask, deleteTask, describeRepeat, nextRepeatDate, periodRange, periodStats, rescheduleTask,
  doneByDay, homeTasks, reopenTask, stalledTasks, taskLists, taskWarning, undoComplete, deadlineLabel } from './tasks';
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
    expect(s.cols.slice(0, 3).map((c) => [c.label, c.plan, c.done])).toEqual([['Пн', 2, 1], ['Вт', 2, 0], ['Ср', 0, 0]]);
    expect(s.cols[2]!.current).toBe(true);
    expect([s.done, s.planned]).toEqual([1, 4]);
    // Не сделано — запланированные на прошедшие дни и не сделанные в тот день: B в пн, B и C во вт.
    expect(s.cols.map((c) => c.missed)).toEqual([1, 2, 0, 0, 0, 0, 0]);
    expect(s.missed).toBe(3);
    expect(s.areas).toMatchObject([{ areaId: 'work', planned: 2, done: 1 }, { areaId: undefined, planned: 1, done: 0 }]);
    // За плитками и сферами — сами задачи, чтобы открыть их из отчёта.
    expect(s.areas[0]!.tasks.map((t) => t.title).sort()).toEqual(['A', 'B']);
    expect(s.lists.done.map((t) => t.title)).toEqual(['A']);
    expect(s.lists.planned.map((t) => t.title).sort()).toEqual(['A', 'B', 'C']);
    expect(s.lists.missed.map((t) => t.title).sort()).toEqual(['B', 'C']);

    const past = periodStats('week', '2026-11-03', '2026-11-20', tasks, events);
    expect(past.current).toBe(false);
    expect(past.lastDone).toBe(6);
    expect(past.defaultIndex).toBe(6);
  });

  it('нарастание: «Было» = конец плана, «Сделано» = последняя точка сделанного; важные — по important, флажки по дням', () => {
    const events: TaskEvent[] = [];
    const tasks: Task[] = [];
    const keep = (c: { task: Task; events: TaskEvent[] }) => {
      const i = tasks.findIndex((t) => t.id === c.task.id);
      if (i >= 0) tasks[i] = c.task;
      else tasks.push(c.task);
      events.push(...c.events);
      return c.task;
    };
    const x = keep(createTask({ title: 'X', date: '2026-11-02', important: true }, at('2026-11-01')));
    keep(completeTask(x, at('2026-11-02', '18:00')));
    keep(createTask({ title: 'Y', date: '2026-11-03', important: true }, at('2026-11-01')));
    const w = keep(createTask({ title: 'W', date: '2026-11-04' }, at('2026-11-01')));
    keep(completeTask(w, at('2026-11-04', '09:00')));
    keep(createTask({ title: 'Z', date: '2026-11-05', important: true }, at('2026-11-01')));

    const s = periodStats('week', TODAY, TODAY, tasks, events);
    expect(s.cum.map((c) => [c.plan, c.done])).toEqual([[1, 1], [2, 1], [3, 2], [4, 2], [4, 2], [4, 2], [4, 2]]);
    expect(s.cum.at(-1)!.plan).toBe(s.planned);
    expect(s.cum[s.lastDone]!.done).toBe(s.done);
    expect([s.planned, s.done, s.missed]).toEqual([4, 2, 1]);
    expect([s.important, s.importantDone]).toEqual([3, 1]);
    expect(s.lists.important.map((t) => t.title).sort()).toEqual(['X', 'Y', 'Z']);
    expect(s.cols.slice(0, 4).map((c) => [c.important, c.importantDone, c.missed])).toEqual([[1, 1, 0], [1, 0, 1], [0, 0, 0], [1, 0, 0]]);
    expect(s.lastDone).toBe(2);
    expect(s.defaultIndex).toBe(2);

    expect(burnupCaption(s, 2)).toEqual({ title: 'Сегодня, 4 ноября', text: 'к этому дню 2 из 3 · отстаю на 1', warn: false });
    expect(burnupCaption(s, 1)).toEqual({ title: 'Вчера, 3 ноября', text: 'к этому дню 1 из 2 · отстаю на 1 · важных 1, сделано 0', warn: true });
    expect(burnupCaption(s, 0)).toEqual({ title: 'Понедельник, 2 ноября', text: 'к этому дню 1 из 1 · важных 1, сделано 1', warn: false });
    expect(burnupCaption(s, 3)).toEqual({ title: 'Завтра, 5 ноября', text: 'запланировано 1 · важных 1', warn: false });
  });

  it('месяц — столбцы по неделям с понедельника, подписи «26 окт», строка «Неделя с …»', () => {
    const s = periodStats('month', TODAY, TODAY, [], []);
    expect(s.cols.map((c) => c.label)).toEqual(['26 окт', '2 ноя', '9 ноя', '16 ноя', '23 ноя', '30 ноя']);
    expect(s.cols[1]!.title).toBe('Неделя с 2 ноября');
    expect(s.cols.map((c) => c.current)).toEqual([false, true, false, false, false, false]);
    expect(s.lastDone).toBe(1);
  });
});

describe('повторяющиеся задачи в «Выполненных»', () => {
  it('выполненная повторяющаяся остаётся open, но по журналу видна как сделанная за день отметки', () => {
    const created = make({ title: 'зарядка', date: TODAY, repeat: { type: 'daily' } });
    const done = completeTask(created.task, NOW + 1000);
    const tasks = [done.task];
    const events = [...created.events, ...done.events];
    const l = taskLists(tasks, TODAY, events);
    expect(done.task.status).toBe('open');
    expect(l.doneToday.map((t) => t.title)).toEqual(['зарядка']);
    expect(l.done).toMatchObject([{ date: TODAY, tasks: [{ title: 'зарядка' }] }]);
    expect(l.today).toEqual([]); // уехала на завтра
    expect([...doneByDay(tasks, events).get(TODAY)!.keys()]).toEqual([done.task.id]);
  });
  it('отменённое выполнение не считается; без журнала — как раньше, по doneAt', () => {
    const created = make({ title: 'зарядка', date: TODAY, repeat: { type: 'daily' } });
    const done = completeTask(created.task, NOW + 1000);
    const undo = reopenTask(done.task, done.events[0], NOW + 2000);
    expect(undo.task).toMatchObject({ status: 'open', date: TODAY });
    expect(taskLists([undo.task], TODAY, [...created.events, ...done.events, ...undo.events]).doneToday).toEqual([]);
    const plain = { ...make({ title: 'обычная' }).task, status: 'done' as const, doneAt: NOW };
    expect(taskLists([plain], TODAY).doneToday.map((t) => t.title)).toEqual(['обычная']);
    const back = reopenTask(plain, undefined, NOW + 5);
    expect(back.task.status).toBe('open');
    expect(back.task.doneAt).toBeUndefined();
    expect(back.events[0]).toMatchObject({ type: 'undone', date: TODAY });
  });
});

describe('done и undone в одну миллисекунду', () => {
  it('порядок не зависит от id: отменённое не считается сделанным', () => {
    const created = make({ title: 'A', date: TODAY });
    const done = completeTask(created.task, NOW);
    const undo = reopenTask(done.task, done.events[0], NOW);
    const events = [...undo.events, ...done.events, ...created.events]; // undone раньше в массиве
    expect(taskLists([undo.task], TODAY, events).doneToday).toEqual([]);
    expect(doneByDay([undo.task], events).size).toBe(0);
  });
});

describe('дедлайн и стоимость дела (этап 29)', () => {
  const t = (deadline?: string, status: 'open' | 'done' = 'open') => ({ deadline, status });
  it('подпись дедлайна: далеко — «до …», завтра, сегодня и прошедший — предупреждением', () => {
    expect(deadlineLabel(t(), '2026-11-04')).toBeNull();
    expect(deadlineLabel(t('2026-11-20'), '2026-11-04')).toEqual({ text: 'до 20 ноября', warn: false });
    expect(deadlineLabel(t('2026-11-05'), '2026-11-04')).toEqual({ text: 'дедлайн завтра', warn: true });
    expect(deadlineLabel(t('2026-11-04'), '2026-11-04')).toEqual({ text: 'дедлайн сегодня', warn: true });
    expect(deadlineLabel(t('2026-11-01'), '2026-11-04')).toEqual({ text: 'дедлайн прошёл 1 ноября', warn: true });
    expect(deadlineLabel(t('2026-11-01', 'done'), '2026-11-04')).toEqual({ text: 'дедлайн 1 ноября', warn: false });
  });
  it('новая задача хранит дедлайн и стоимость в валюте', () => {
    const { task } = createTask({ title: 'Билеты', deadline: '2026-12-01', cost: 4_500_000, costCurrency: 'KGS' }, Date.parse('2026-11-04T10:00:00+06:00'));
    expect(task).toMatchObject({ deadline: '2026-12-01', cost: 4_500_000, costCurrency: 'KGS' });
  });
});
