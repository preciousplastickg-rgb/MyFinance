import { addDays, addMonths, clampedDate, diffDays, formatDayTitle, formatShortDate, monthOf, monthRange, parseLocalDate, toLocalDate, weekdayOf } from './date';
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
  fields: Pick<Task, 'title'> & Partial<Pick<Task, 'areaId' | 'date' | 'time' | 'important' | 'note' | 'repeat' | 'icon' | 'goalId' | 'deadline' | 'cost' | 'costCurrency'>>,
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

/**
 * «Вернуть в работу» из «Выполненных»: обычная задача снова open без doneAt;
 * повторяющаяся (она и так open) возвращается на день, за который была отмечена.
 */
export function reopenTask(task: Task, doneEvent: TaskEvent | undefined, now: number): TaskChange {
  const before: Task = { ...task, status: 'open' };
  delete before.doneAt;
  if (task.repeat && doneEvent) before.date = doneEvent.date;
  const done = doneEvent ?? { id: '', taskId: task.id, type: 'done' as const, date: toLocalDate(now), at: 0 };
  return undoComplete(before, done, now);
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
  /** «Выполненные»: по дню выполнения, новые дни сверху, внутри дня — последние сверху. */
  done: { date: LocalDate; tasks: Task[] }[];
  counts: { today: number; upcoming: number; inbox: number; overdue: number };
}

/** События по времени; при равном времени «отменено» идёт после «сделано» — иначе порядок зависел бы от id. */
const byTime = (a: TaskEvent, b: TaskEvent) => a.at - b.at || Number(a.type === 'undone') - Number(b.type === 'undone');

/**
 * Сделанное по дням: обычные задачи — по doneAt, повторяющиеся — по журналу (они остаются open, см. completeTask).
 * Отменённое выполнение (undone) не считается. Значение — момент отметки.
 */
export function doneByDay(tasks: readonly Task[], events: readonly TaskEvent[]): Map<LocalDate, Map<Id, number>> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out = new Map<LocalDate, Map<Id, number>>();
  const put = (date: LocalDate, id: Id, at: number) => {
    const day = out.get(date) ?? new Map<Id, number>();
    day.set(id, Math.max(day.get(id) ?? 0, at));
    out.set(date, day);
  };
  for (const t of tasks) if (t.status === 'done' && t.doneAt !== undefined) put(toLocalDate(t.doneAt), t.id, t.doneAt);
  for (const e of [...events].sort(byTime)) {
    const t = byId.get(e.taskId);
    if (!t || t.status === 'deleted') continue;
    if (e.type === 'done') put(e.date, e.taskId, e.at);
    else if (e.type === 'undone' && t.status !== 'done') out.get(e.date)?.delete(e.taskId);
  }
  for (const [date, day] of out) if (!day.size) out.delete(date);
  return out;
}

/** Сегодня / Предстоящие (30 дней + «Позже») / «Без даты» (SPEC 7.1). events — чтобы видеть сделанные повторяющиеся задачи. */
export function taskLists(tasks: readonly Task[], today: LocalDate, events: readonly TaskEvent[] = []): TaskLists {
  const open = tasks.filter((t) => t.status === 'open');
  const overdue = open.filter((t) => t.date && t.date < today).sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : byTimeThenCreated(a, b)));
  const todayList = open.filter((t) => t.date === today).sort(byTimeThenCreated);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const doneMap = doneByDay(tasks, events);
  const dayTasks = (date: LocalDate, newestFirst: boolean) =>
    [...(doneMap.get(date) ?? new Map<Id, number>()).entries()]
      .sort(([, a], [, b]) => (newestFirst ? b - a : a - b))
      .map(([id]) => byId.get(id))
      .filter((t): t is Task => !!t);
  const doneToday = dayTasks(today, false);
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
  const done = [...doneMap.keys()].sort((a, b) => (a < b ? 1 : -1)).map((date) => ({ date, tasks: dayTasks(date, true) }));
  return {
    overdue, today: todayList, doneToday, upcoming, later, inbox, done,
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

/**
 * Дедлайн дела (этап 29): «до 12 ноября»; завтра, сегодня и прошедший — предупреждением. У сделанного — просто дата.
 */
export function deadlineLabel(task: Pick<Task, 'deadline' | 'status'>, today: LocalDate): { text: string; warn: boolean } | null {
  if (!task.deadline) return null;
  if (task.status !== 'open') return { text: `дедлайн ${formatShortDate(task.deadline)}`, warn: false };
  const d = diffDays(today, task.deadline);
  if (d < 0) return { text: `дедлайн прошёл ${formatShortDate(task.deadline)}`, warn: true };
  if (d === 0) return { text: 'дедлайн сегодня', warn: true };
  if (d === 1) return { text: 'дедлайн завтра', warn: true };
  return { text: `до ${formatShortDate(task.deadline)}`, warn: false };
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
  const sorted = [...events].sort(byTime);
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

/** Столбец нарастания (этап 30): день недели или неделя месяца. */
export interface BurnupCol {
  /** День или понедельник недели. */
  key: LocalDate;
  /** Подпись под графиком: «Пн» или «29 сен». */
  label: string;
  /** Строка итога: «Сегодня, 4 ноября», «Понедельник, 2 ноября», «Неделя с 27 октября». */
  title: string;
  plan: number;
  done: number;
  important: number;
  importantDone: number;
  past: boolean;
  current: boolean;
  future: boolean;
  /** Не сделано в прошедший день (неделю): план − сделано; у сегодняшнего и будущих — 0. */
  missed: number;
}

export interface PeriodStats {
  from: LocalDate;
  to: LocalDate;
  current: boolean;
  cols: BurnupCol[];
  /** Накопленные план и сделано по столбцам. */
  cum: { plan: number; done: number }[];
  /** Плитки: «Было» = конец плана, «Сделано» = последняя точка сделанного, «Не сделано» (просрочено), «Важных» и сколько сделано. */
  planned: number;
  done: number;
  missed: number;
  important: number;
  importantDone: number;
  /** Последний столбец, до которого рисуется «сделано» (сегодня или конец прошлого периода); −1 — период ещё не начался. */
  lastDone: number;
  /** Выбранный по умолчанию: сегодня (неделя с сегодня), в прошлом периоде — последний. */
  defaultIndex: number;
  areas: { areaId: Id | undefined; planned: number; done: number; tasks: Task[] }[];
  /** Сами задачи за плитками — чтобы открыть их из отчёта (7b). */
  lists: { planned: Task[]; done: Task[]; missed: Task[]; important: Task[] };
}

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** «29 сен» — подпись недели под графиком месяца. */
function shortDay(date: LocalDate): string {
  const [day, month] = formatShortDate(date).split(' ');
  return `${day} ${month!.slice(0, 3)}`;
}

/**
 * Отчёт по делам за неделю или месяц (SPEC 7.3, этап 30): нарастание плана и сделанного по дням недели или неделям месяца,
 * четыре плитки и важные. Запланировано на день D и сделано в D — по журналу (dayStats); задача, перенесённая с понедельника
 * на вторник, — в плане обоих дней, поэтому «Было» = сумма по дням, как и раньше. Важные — по признаку important сейчас.
 */
export function periodStats(kind: PeriodKind, ref: LocalDate, today: LocalDate, tasks: readonly Task[], events: readonly TaskEvent[]): PeriodStats {
  const { from, to } = periodRange(kind, ref);
  const current = from <= today && today <= to;
  const { planned, done } = dayStats(tasks, events);
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const days: LocalDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);

  const plannedIds = new Set<Id>();
  const doneIds = new Set<Id>();
  const missedIds = new Set<Id>();
  const day = (d: LocalDate) => {
    const p = planned.get(d) ?? new Set<Id>();
    const dn = done.get(d) ?? new Set<Id>();
    let important = 0;
    let importantDone = 0;
    for (const id of p) {
      plannedIds.add(id);
      if (taskById.get(id)?.important) {
        important++;
        if (dn.has(id)) importantDone++;
      }
      if (d < today && !dn.has(id)) missedIds.add(id);
    }
    dn.forEach((id) => doneIds.add(id));
    return { plan: p.size, done: dn.size, important, importantDone };
  };

  // Неделя: столбец — день; месяц: столбец — неделя (пн–вс, только дни этого месяца).
  const groups: LocalDate[][] = [];
  if (kind === 'week') days.forEach((d) => groups.push([d]));
  else {
    const weeks = new Map<LocalDate, LocalDate[]>();
    for (const d of days) {
      const monday = addDays(d, 1 - weekdayOf(d));
      weeks.set(monday, [...(weeks.get(monday) ?? []), d]);
    }
    groups.push(...weeks.values());
  }
  const cols: BurnupCol[] = groups.map((ds, i) => {
    const first = ds[0]!;
    const last = ds[ds.length - 1]!;
    const sum = ds.map(day).reduce((a, b) => ({ plan: a.plan + b.plan, done: a.done + b.done, important: a.important + b.important, importantDone: a.importantDone + b.importantDone }));
    const past = last < today;
    const future = first > today;
    const monday = addDays(first, 1 - weekdayOf(first));
    return {
      key: kind === 'week' ? first : monday,
      label: kind === 'week' ? WEEKDAY_LABELS[i]! : shortDay(monday),
      title: kind === 'week' ? formatDayTitle(first, today) : `Неделя с ${formatShortDate(monday)}`,
      ...sum,
      past,
      current: !past && !future,
      future,
      missed: past ? sum.plan - sum.done : 0,
    };
  });
  let plan = 0;
  let doneSum = 0;
  const cum = cols.map((c) => ({ plan: (plan += c.plan), done: (doneSum += c.done) }));
  const lastDone = current ? cols.findIndex((c) => c.current) : from > today ? -1 : cols.length - 1;

  const areaMap = new Map<Id | undefined, { planned: number; done: number; tasks: Task[] }>();
  for (const id of plannedIds) {
    const task = taskById.get(id);
    const areaId = task?.areaId;
    let cur = areaMap.get(areaId);
    if (!cur) {
      cur = { planned: 0, done: 0, tasks: [] };
      areaMap.set(areaId, cur);
    }
    cur.planned++;
    if (doneIds.has(id)) cur.done++;
    if (task) cur.tasks.push(task);
  }
  const areas = [...areaMap.entries()].map(([areaId, v]) => ({ areaId, ...v })).sort((a, b) => b.planned - a.planned);
  const toTasks = (ids: Iterable<Id>) => [...ids].map((id) => taskById.get(id)).filter((t): t is Task => !!t);

  return {
    from, to, current, cols, cum,
    planned: plan,
    done: doneSum,
    missed: cols.reduce((a, c) => a + c.missed, 0),
    important: cols.reduce((a, c) => a + c.important, 0),
    importantDone: cols.reduce((a, c) => a + c.importantDone, 0),
    lastDone,
    defaultIndex: Math.max(0, lastDone),
    areas,
    lists: {
      planned: toTasks(plannedIds),
      done: toTasks(doneIds),
      missed: toTasks(missedIds),
      important: toTasks(plannedIds).filter((t) => t.important),
    },
  };
}

/**
 * Строка итога под плитками (этап 30): «Сегодня, 4 ноября» и «к этому дню 7 из 11 · отстаю на 4 · важных 2, сделано 1».
 * Будущий день — «запланировано N». warn — в выбранный прошедший день что-то не сделано.
 */
export function burnupCaption(s: Pick<PeriodStats, 'cols' | 'cum'>, index: number): { title: string; text: string; warn: boolean } {
  const c = s.cols[index]!;
  const cum = s.cum[index]!;
  const imp = c.important ? ` · важных ${c.important}${c.future ? '' : `, сделано ${c.importantDone}`}` : '';
  const text = c.future
    ? `запланировано ${c.plan}${imp}`
    : `к этому дню ${cum.done} из ${cum.plan}${cum.plan > cum.done ? ` · отстаю на ${cum.plan - cum.done}` : ''}${imp}`;
  return { title: c.title, text, warn: c.missed > 0 };
}
