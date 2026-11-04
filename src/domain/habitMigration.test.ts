import { describe, expect, it } from 'vitest';
import { migrateHabitsV5 } from './habitMigration';
import { habitView } from './habits';
import type { Habit, HabitLog } from './types';

const base = { icon: 'Star', color: '#2448D6', startDate: '2026-11-01', sortOrder: 0, archived: false };
const h = (extra: Partial<Habit> & Pick<Habit, 'id' | 'kind'>): Habit => ({ name: extra.id, ...base, ...extra });
const log = (id: string, habitId: string, date: string, value = 1): HabitLog => ({ id, habitId, date, value, at: 1 });
const TODAY = '2026-11-04';

describe('миграция привычек v4 → v5', () => {
  it('«каждый день» не меняется', () => {
    const med = h({ id: 'med', kind: 'daily' });
    expect(migrateHabitsV5([med], [], TODAY, 9)).toEqual({ habits: [med], changedLogs: [], addedLogs: [] });
  });

  it('«N раз в неделю» получает дни; 7 раз — каждый день', () => {
    const m = migrateHabitsV5([h({ id: 'a', kind: 'weekly', target: 3 }), h({ id: 'b', kind: 'weekly', target: 2 }), h({ id: 'c', kind: 'weekly', target: 7 })], [], TODAY, 9);
    expect(m.habits.map((x) => [x.kind, x.legacyKind, x.days, x.target])).toEqual([
      ['daily', 'weekly', [1, 3, 5], 3],
      ['daily', 'weekly', [2, 4], 2],
      ['daily', 'weekly', undefined, 7],
    ]);
  });

  it('«количество»: цель — в подпись, засчитанные дни остаются галочками, неполные — нет', () => {
    const water = h({ id: 'w', kind: 'count', target: 8, unit: 'стаканов' });
    const logs = [log('l1', 'w', '2026-11-02', 8), log('l2', 'w', '2026-11-03', 5)];
    const m = migrateHabitsV5([water], logs, TODAY, 9);
    expect(m.habits[0]).toEqual({ ...water, kind: 'daily', legacyKind: 'count', note: '8 стаканов' });
    expect(m.changedLogs).toEqual([]);
    expect(m.addedLogs).toEqual([]);
    const v = habitView(m.habits[0]!, logs, TODAY);
    expect([v.done('2026-11-02'), v.done('2026-11-03')]).toEqual([true, false]);
  });

  it('«дни без»: галочка за каждый день без срыва до сегодня; срыв остаётся со значением 0', () => {
    const sugar = h({ id: 's', kind: 'abstain' });
    const logs = [log('r', 's', '2026-11-02')];
    const m = migrateHabitsV5([sugar], logs, TODAY, 9);
    expect(m.habits[0]).toEqual({ ...sugar, kind: 'daily', legacyKind: 'abstain' });
    expect(m.changedLogs).toEqual([{ ...logs[0], value: 0 }]);
    expect(m.addedLogs.map((l) => l.date)).toEqual(['2026-11-01', '2026-11-03', '2026-11-04']);
    expect(m.addedLogs[0]).toEqual({ id: 'abstain-s-2026-11-01', habitId: 's', date: '2026-11-01', value: 1, at: 9 });
    const v = habitView(m.habits[0]!, [...m.changedLogs, ...m.addedLogs], TODAY);
    expect(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'].map((d) => v.done(d))).toEqual([true, false, true, true]);
  });
});
