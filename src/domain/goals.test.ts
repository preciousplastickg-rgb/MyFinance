import { describe, expect, it } from 'vitest';
import { dueFromPreset, goalProgress, leftLabel, linksLine, partsLine, perMonth, shortName } from './goals';

describe('цели', () => {
  it('срок по пресету — то же число через N месяцев, конец месяца подрезается', () => {
    expect(dueFromPreset('2026-11-06', '3m')).toBe('2027-02-06');
    expect(dueFromPreset('2026-11-30', '3m')).toBe('2027-02-28');
    expect(dueFromPreset('2026-11-06', '1y')).toBe('2027-11-06');
    expect(dueFromPreset('2026-11-06', 'none')).toBeUndefined();
  });
  it('прогресс — среднее по имеющимся частям (пример из прототипа: 38 / 61 / 1 из 3 → 44%)', () => {
    const p = goalProgress({ jar: { balance: 45_000_00, target: 120_000_00 }, habitRates: [61], tasks: [{ status: 'done' }, { status: 'open' }, { status: 'open' }] });
    expect(p.parts.map((x) => x.value)).toEqual(['38%', '61%', '1 из 3']);
    expect(p.percent).toBe(44);
    expect(partsLine(p)).toBe('деньги 38% · привычки 61% · дела 1 из 3');
  });
  it('части без данных не участвуют; удалённые дела не считаются', () => {
    expect(goalProgress({ habitRates: [87, 87], tasks: [{ status: 'done' }, { status: 'open' }, { status: 'deleted' }] }).percent).toBe(69);
    expect(goalProgress({ habitRates: [], tasks: [] }).parts).toEqual([]);
    expect(partsLine(goalProgress({ habitRates: [], tasks: [] }))).toBe('пока пусто');
  });
  it('подписи связей и срока', () => {
    expect(linksLine(true, 1, 3)).toBe('копилка, 1 привычка, 3 дела');
    expect(linksLine(false, 2, 0)).toBe('2 привычки');
    expect(linksLine(false, 0, 0)).toBe('ничего не связано');
    expect(leftLabel('2026-11-06', '2027-03-15')).toBe('осталось 4 месяца');
    expect(leftLabel('2026-11-06', '2026-12-31')).toBe('осталось 8 недель');
    expect(leftLabel('2026-11-06', '2026-11-10')).toBe('осталось 4 дня');
    expect(leftLabel('2026-11-06', '2026-11-01')).toBe('срок прошёл');
  });
  it('по сколько в месяц — вверх до 10 сом', () => {
    expect(perMonth(75_000_00, '2026-11-06', '2027-03-15')).toBe(18_750_00);
    expect(perMonth(10_000_00, '2026-11-06', '2027-02-06')).toBe(3_340_00);
    expect(shortName('Отпуск в Стамбуле')).toBe('Отпуск');
  });
});
