import { describe, expect, it } from 'vitest';
import { activeDays, dayPayments, dayTasks, monthGrid } from './day';
import type { Recurring, Task, TaskEvent } from './types';

describe('сетка месяца', () => {
  it('ноябрь 2026: начинается с воскресенья, 6 недель пн–вс', () => {
    const g = monthGrid('2026-11');
    expect(g).toHaveLength(6);
    expect(g[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(g[5]).toEqual(['2026-11-30', null, null, null, null, null, null]);
  });
  it('февраль 2027 с понедельника — ровно 4 недели', () => {
    const g = monthGrid('2027-02');
    expect(g).toHaveLength(4);
    expect(g[0]![0]).toBe('2027-02-01');
    expect(g[3]![6]).toBe('2027-02-28');
  });
});

const rec = (id: string, extra: Partial<Recurring> = {}): Recurring => ({
  id, kind: 'expense', name: id, amount: 100_000, currency: 'KGS', accountId: 'mbank', categoryId: 'c',
  schedule: { type: 'monthly', day: 10 }, isMandatory: true, isSubscription: false, startDate: '2026-01-01', active: true, ...extra,
});

describe('платежи дня', () => {
  it('любой день, даже вне окна «Сегодня»: статус из журнала, доходы первыми', () => {
    const recurring = [rec('Аренда'), rec('Зарплата', { kind: 'income' }), rec('Связь', { schedule: { type: 'monthly', day: 11 } }), rec('Старое', { active: false })];
    const logs = [{ id: 'l', recurringId: 'Аренда', dueDate: '2026-03-10', status: 'done' as const }];
    const day = dayPayments(recurring, logs, '2026-03-10');
    expect(day.map((o) => [o.recurring.id, o.status])).toEqual([['Зарплата', 'pending'], ['Аренда', 'done']]);
  });
});

const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, important: false, status: 'open', postponeCount: 0, createdAt: 0, ...extra });
const ev = (taskId: string, type: TaskEvent['type'], date: string, at: number): TaskEvent => ({ id: `${taskId}${at}`, taskId, type, date, at });

describe('дела дня', () => {
  it('сделанные в этот день и открытые на эту дату; отменённое «сделано» не считается', () => {
    const tasks = [task('a', { status: 'done' }), task('b', { date: '2026-11-03' }), task('c', { date: '2026-11-03' }), task('d', { status: 'deleted' })];
    const events = [ev('a', 'done', '2026-11-03', 1), ev('c', 'done', '2026-11-03', 2), ev('c', 'undone', '2026-11-03', 3), ev('d', 'done', '2026-11-03', 4)];
    const day = dayTasks(tasks, events, '2026-11-03');
    expect(day.done.map((t) => t.id)).toEqual(['a']);
    expect(day.open.map((t) => t.id)).toEqual(['b', 'c']);
  });
});

describe('точки в календаре', () => {
  it('дни с операциями, сделанными делами и отметками привычек — только этот месяц', () => {
    const days = activeDays('2026-11', [{ date: '2026-11-02' }, { date: '2026-10-31' }], [{ date: '2026-11-03', type: 'done' }, { date: '2026-11-05', type: 'created' }], [{ date: '2026-11-04' }]);
    expect([...days].sort()).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']);
  });
});
