import { addDays, addMonths, clampedDate, diffDays, monthOf, monthRange, parseLocalDate, toLocalDate, weekdayOf } from './date';
import { plural } from './money';
import type { Id, LocalDate, Task, TaskEvent, TaskRepeat } from './types';

const newId = () => crypto.randomUUID();

// ── Повторы ─────────────────────────────────────────────

/** Следующее наступление строго после `after`. */
export function nextRepeatDate(repeat: TaskRepeat, after: LocalDate): LocalDate {
  if (repeat.type === 'daily') return addDays(after, 1);
  if (repeat.type === 'weekly') {
    const days = repeat.weekdays.length ? repeat.weekdays : [weekdayOf(after)];
    for (let i = 1; i <= 7; i++) {
      const d = addDays(after, i);
      if (days.includes(weekdayOf(d))) return d;
    }
    return addDays(after, 7);
  }
  const { year, month } = parseLocalDate(after);
  const same = clampedDate(year, month, repeat.day);
  if (same > after) return same;
  const next = parseLocalDate(`${addMonths(monthOf(after), 1)}-01`);
  return clampedDate(next.year, next.month, repeat.day);
}

const WEEKDAY_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

export function describeRepeat(repeat: TaskRepeat): string {
  if (repeat.type === 'daily') return 'каждый день';
  if (repeat.type === 'monthly') return `каждое ${repeat.day}-е`;
  const days = [...repeat.weekdays].sort();
  if (days.length === 5 && days.every((d, i) => d === i + 1)) return 'по будням';
  return days.map((d) => WEEKDAY_SHORT[d - 1]).join(', ');
}

// ── Изменения задач (возвращают новую задачу и события журнала) ──

export interface TaskChange {
  task: Task;
  events: TaskEvent[];
}

const event = (task: Task, type: TaskEvent['type'], date: LocalDate, at: number, extra: Partial<TaskEvent> = {}): TaskEvent => ({
  id: newId(), taskId: task.id, type, date, at, ...extra,
});

export function createTask(
  fields: Pick<Task, 'title'> & Partial<Pick<Task, 'areaId' | 'date' | 'time' | 'important' | 'note' | 'repeat' | 'icon'>>,
  now: number,
): TaskChange {
  const task: Task = { id: newId(), important: false, status: 'open', postponeCount: 0, createdAt: now, ...fields, title: fields.title.trim() };
  return { task, events: [event(task, 'created', toLocalDate(now), now, task.date ? { toDate: task.date } : {})] };
}

/**
 * Перенос = смена даты открытой задачи на более позднюю или снятие даты: postponeCount++ и TaskEvent(postponed).
 * Перенос на более раннюю дату и назначение даты задаче без даты переносом не считаются (SPEC 7.2).
 */
export function isPostpone(task: Task, newDate: LocalDate | undefined): boolean {
  if (task.status !== 'open' || !task.date) return false;
  return newDate === undefined || newDate > task.date;
}

export function rescheduleTask(task: Task, newDate: LocalDate | undefined, now: number): TaskChange {
  if (newDate === task.date) return { task, events: [] };
  const { date: _old, ...rest } = task;
  const moved: Task = newDate ? { ...rest, date: newDate } : rest;
  if (!newDate) delete moved.time;
  if (!isPostpone(task, newDate)) return { task: moved, events: [] };
  return {
    task: { ...moved, postponeCount: task.postponeCount + 1 },
    events: [event(task, 'postponed', toLocalDate(now), now, { fromDate: task.date, ...(newDate ? { toDate: newDate } : {}) })],
  };
}

/**
 * Выполнить. Повторяющаяся: TaskEvent(done) с текущей date задачи, затем date сдвигается на следующее
 * наступление, status остаётся open, postponeCount обнуляется (SPEC 7.2).
 */
export function completeTask(task: Task, now: number): TaskChange {
  const today = toLocalDate(now);
  if (task.repeat) {
    const doneDate = task.date ?? today;
    const from = task.date && task.date > today ? task.date : today;
    return {
      task: { ...task, date: nextRepeatDate(task.repeat, from), postponeCount: 0 },
      events: [event(task, 'done', doneDate, now)],
    };
  }
  return { task: { ...task, status: 'done', doneAt: now }, events: [event(task, 'done', today, now)] };
}

/** Отмена выполнения: восстанавливается прежнее состояние, в журнал — TaskEvent(undone) с датой отменяемого done. */
export function undoComplete(before: Task, doneEvent: TaskEvent, now: number): TaskChange {
  return { task: before, events: [event(before, 'undone', doneEvent.date, now)] };
}

export function deleteTask(task: Task, now: number): TaskChange {
  return { task: { ...task, status: 'deleted' }, events: [event(task, 'deleted', toLocalDate(now), now)] };
}

// ── Списки ──────────────────────────────────────────────

function byTimeThenCreated(a: Task, b: Task): number {
  if (a.time && b.time) return a.time < b.time ? -1 : a.time > b.time ? 1 : a.createdAt - b.createdAt;
  if (a.time) return -1;
  if (b.time) return 1;
  return a.createdAt - b.createdAt;
}

export interface TaskLists {
  overdue: Task[];
  today: Task[];
  doneToday: Task[];
  upcoming: { date: LocalDate; tasks: Task[] }[];
  later: Task[];
  inbox: Task[];
  counts: { today: number; upcoming: number; inbox: number; overdue: number };
}

/** Сегодня / Предстоящие (30 дней + «Позже») / «Без даты» (SPEC 7.1). */
export function taskLists(tasks: readonly Task[], today: LocalDate): TaskLists {
  const open = tasks.filter((t) => t.status === 'open');
  const overdue = open.filter((t) => t.date && t.date < today).sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : byTimeThenCreated(a, b)));
  const todayList = open.filter((t) => t.date === today).sort(byTimeThenCreated);
  const doneToday = tasks
    .filter((t) => t.status === 'done' && t.doneAt !== undefined && toLocalDate(t.doneAt) === today)
    .sort((a, b) => a.doneAt! - b.doneAt!);
  const horizon = addDays(today, 30);
  const future = open.filter((t) => t.date && t.date > today);
  const byDate = new Map<LocalDate, Task[]>();
  for (const t of future.filter((t) => t.date! <= horizon)) {
    const list = byDate.get(t.date!) ?? [];
    list.push(t);
    byDate.set(t.date!, list);
  }
  const upcoming = [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, list]) => ({ date, tasks: list.sort(byTimeThenCreated) }));
  const later = future.filter((t) => t.date! > horizon).sort((a, b) => (a.date! < b.date! ? -1 : 1));
  const inbox = open.filter((t) => !t.date).sort((a, b) => b.createdAt - a.createdAt);
  return {
    overdue, today: todayList, doneToday, upcoming, later, inbox,
    counts: { today: overdue.length + todayList.length, upcoming: future.length, inbox: inbox.length, overdue: overdue.length },
  };
}

export interface HomeTasks {
  today: Task[];
  todayMore: number;
  tomorrow: Task[];
  tomorrowMore: number;
}

/** Важные первыми, остальной порядок списка сохраняется. */
const importantFirst = (list: Task[]) => [...list.filter((t) => t.important), ...list.filter((t) => !t.important)];

/**
 * Блок дел на «Сегодня»: всего не больше `max` задач за сегодня (с просроченными) и завтра.
 * Пополам на каждый день; если одному дню мест нужно меньше, остаток отдаётся другому.
 * Внутри дня — сначала важные, затем просроченные, затем по времени.
 */
export function homeTasks(lists: TaskLists, today: LocalDate, max = 6): HomeTasks {
  const todayAll = importantFirst([...lists.overdue, ...lists.today]);
  const tomorrowAll = importantFirst(lists.upcoming.find((g) => g.date === addDays(today, 1))?.tasks ?? []);
  const half = Math.floor(max / 2);
  const todayN = Math.min(todayAll.length, Math.max(half, max - tomorrowAll.length));
  const tomorrowN = Math.min(tomorrowAll.length, max - todayN);
  return {
    today: todayAll.slice(0, todayN),
    todayMore: todayAll.length - todayN,
    tomorrow: tomorrowAll.slice(0, tomorrowN),
    tomorrowMore: tomorrowAll.length - tomorrowN,
  };
}

/** Бейдж: 0 — скрыт, больше 99 — «99+». */
export function badgeText(n: number): string | null {
  if (n <= 0) return null;
  return n > 99 ? '99+' : String(n);
}

/** Сколько дней задача без даты. */
export function inboxAge(task: Task, today: LocalDate): number {
  return diffDays(toLocalDate(task.createdAt), today);
}

/** «Перенесено N раз» при postponeCount ≥ 3, «Без даты уже N дней» при возрасте без даты ≥ 14 дней. */
export function taskWarning(task: Task, today: LocalDate): string | null {
  if (task.status !== 'open') return null;
  if (task.postponeCount >= 3) return `Перенесено ${task.postponeCount} ${plural(task.postponeCount, ['раз', 'раза', 'раз'])}`;
  if (!task.date) {
    const age = inboxAge(task, today);
    if (age >= 14) return `Без даты уже ${age} ${plural(age, ['день', 'дня', 'дней'])}`;
  }
  return null;
}

/** «Откладывается»: postponeCount ≥ 3 или дольше 14 дней без даты (SPEC 7.3). */
export function stalledTasks(tasks: readonly Task[], today: LocalDate): Task[] {
  return tasks.filter((t) => t.status === 'open' && (t.postponeCount >= 3 || (!t.date && inboxAge(t, today) >= 14)));
}

// ── Статистика ──────────────────────────────────────────

export type PeriodKind = 'week' | 'month';

export function periodRange(kind: PeriodKind, ref: LocalDate): { from: LocalDate; to: LocalDate } {
  if (kind === 'month') return monthRange(monthOf(ref));
  const from = addDays(ref, 1 - weekdayOf(ref));
  return { from, to: addDays(from, 6) };
}

export function shiftPeriod(kind: PeriodKind, ref: LocalDate, n: number): LocalDate {
  return kind === 'week' ? addDays(ref, n * 7) : `${addMonths(monthOf(ref), n)}-01`;
}

/**
 * Запланировано на день D — задачи, у которых в какой-то момент была дата D (по журналу и текущей дате), кроме удалённых.
 * Сделано — события done с датой D без последующего undone (SPEC 7.3).
 */
export function dayStats(tasks: readonly Task[], events: readonly TaskEvent[]) {
  const deleted = new Set(tasks.filter((t) => t.status === 'deleted').map((t) => t.id));
  const planned = new Map<LocalDate, Set<Id>>();
  const add = (date: LocalDate | undefined, id: Id) => {
    if (!date || deleted.has(id)) return;
    const set = planned.get(date) ?? new Set<Id>();
    set.add(id);
    planned.set(date, set);
  };
  for (const t of tasks) add(t.date, t.id);
  const sorted = [...events].sort((a, b) => a.at - b.at);
  for (const e of sorted) {
    if (e.type === 'created' || e.type === 'postponed') {
      add(e.fromDate, e.taskId);
      add(e.toDate, e.taskId);
    }
    if (e.type === 'done') add(e.date, e.taskId);
  }
  const done = new Map<LocalDate, Set<Id>>();
  for (const e of sorted) {
    if (deleted.has(e.taskId)) continue;
    if (e.type === 'done') {
      const set = done.get(e.date) ?? new Set<Id>();
      set.add(e.taskId);
      done.set(e.date, set);
    } else if (e.type === 'undone') done.get(e.date)?.delete(e.taskId);
  }
  return { planned, done };
}

export interface PeriodStats {
  from: LocalDate;
  to: LocalDate;
  current: boolean;
  done: number;
  planned: number;
  /** Осталось (текущий период) или перенесено (прошедший). */
  second: { label: 'Осталось' | 'Перенесено'; value: number };
  overdue: number;
  bars: { key: string; label: string; planned: number; done: number; today: boolean }[];
  areas: { areaId: Id | undefined; planned: number; done: number }[];
}

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function periodStats(kind: PeriodKind, ref: LocalDate, today: LocalDate, tasks: readonly Task[], events: readonly TaskEvent[]): PeriodStats {
  const { from, to } = periodRange(kind, ref);
  const current = from <= today && today <= to;
  const { planned, done } = dayStats(tasks, events);
  const days: LocalDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);

  const plannedIds = new Set<Id>();
  const doneIds = new Set<Id>();
  let doneCount = 0;
  let plannedCount = 0;
  for (const d of days) {
    planned.get(d)?.forEach((id) => plannedIds.add(id));
    done.get(d)?.forEach((id) => doneIds.add(id));
    plannedCount += planned.get(d)?.size ?? 0;
    doneCount += done.get(d)?.size ?? 0;
  }

  let bars: PeriodStats['bars'];
  if (kind === 'week') {
    bars = days.map((d, i) => ({ key: d, label: WEEKDAY_LABELS[i]!, planned: planned.get(d)?.size ?? 0, done: done.get(d)?.size ?? 0, today: d === today }));
  } else {
    const weeks = new Map<LocalDate, LocalDate[]>();
    for (const d of days) {
      const monday = addDays(d, 1 - weekdayOf(d));
      weeks.set(monday, [...(weeks.get(monday) ?? []), d]);
    }
    bars = [...weeks.values()].map((ds) => ({
      key: ds[0]!,
      label: `${parseLocalDate(ds[0]!).day}–${parseLocalDate(ds[ds.length - 1]!).day}`,
      planned: ds.reduce((s, d) => s + (planned.get(d)?.size ?? 0), 0),
      done: ds.reduce((s, d) => s + (done.get(d)?.size ?? 0), 0),
      today: ds.includes(today),
    }));
  }

  const inPeriod = (d?: LocalDate) => !!d && d >= from && d <= to;
  const open = tasks.filter((t) => t.status === 'open');
  const overdue = open.filter((t) => inPeriod(t.date) && t.date! < today).length;
  const second: PeriodStats['second'] = current
    ? { label: 'Осталось', value: open.filter((t) => inPeriod(t.date) && t.date! >= today).length }
    : { label: 'Перенесено', value: events.filter((e) => e.type === 'postponed' && inPeriod(e.date)).length };

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const areaMap = new Map<Id | undefined, { planned: number; done: number }>();
  for (const id of plannedIds) {
    const areaId = taskById.get(id)?.areaId;
    const cur = areaMap.get(areaId) ?? { planned: 0, done: 0 };
    areaMap.set(areaId, { planned: cur.planned + 1, done: cur.done + (doneIds.has(id) ? 1 : 0) });
  }
  const areas = [...areaMap.entries()].map(([areaId, v]) => ({ areaId, ...v })).sort((a, b) => b.planned - a.planned);

  return { from, to, current, done: doneCount, planned: plannedCount, second, overdue, bars, areas };
}
