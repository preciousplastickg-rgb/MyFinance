import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { DEFAULT_SETTINGS } from '../db/db';
import { bishkekTime, minutesOfDay, toLocalDate } from '../domain/date';
import { autoIncomes, INCOME_MINUTES, occurrences } from '../domain/recurring';
import type { Account, Recurring } from '../domain/types';
import { autoCompleteIncome, completeOccurrence, skipOccurrence } from './actions';

/**
 * Граница 17:00 в день зарплаты — то, что делает useAutoIncome: occurrences → autoIncomes(минуты по Бишкеку) → autoCompleteIncome.
 * И гонка, которую ловит граница: окно «Зарплата» открыто в 16:59, доход зачислился сам в 17:00, потом нажали «Пришло»
 * или «Пропустить» — на одно наступление не должно появиться второй операции или «пропущено» поверх «сделано».
 */
const DAY = '2026-11-10';
const SINCE = '2026-11-04';
const mbank: Account = {
  id: 'mbank', name: 'MBank', type: 'bank', currency: 'KGS', icon: 'Landmark', color: 'blue',
  includeInDaily: true, openingBalance: 2_000_000, openingDate: '2026-11-01', sortOrder: 0, archived: false,
};
const salary: Recurring = {
  id: 'salary', kind: 'income', name: 'Зарплата', amount: 6_000_000, currency: 'KGS', accountId: 'mbank', categoryId: 'c',
  schedule: { type: 'monthly', day: 10 }, isMandatory: false, isSubscription: false, startDate: '2026-11-04', active: true,
};

/** Момент дня зарплаты по Бишкеку: «16:59» → timestamp. */
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return bishkekTime(DAY, h * 60 + m);
};

/** Один проход useAutoIncome в момент now: что пора зачислить — зачисляет. */
async function autoIncomeTick(now: number) {
  const today = toLocalDate(now);
  const due = autoIncomes(occurrences([salary], await db.occurrenceLog.toArray(), today), today, minutesOfDay(now), SINCE);
  for (const o of due) await autoCompleteIncome(o.recurring, o.dueDate, bishkekTime(o.dueDate, INCOME_MINUTES));
  return due.length;
}

const salaryTxs = () => db.transactions.where('recurringId').equals('salary').toArray();
const statusOfSalary = async () => occurrences([salary], await db.occurrenceLog.toArray(), DAY).find((o) => o.dueDate === DAY)?.status;

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ ...DEFAULT_SETTINGS, autoIncomeSince: SINCE });
  await db.accounts.put(mbank);
  await db.recurring.put(salary);
});

describe('доход в 17:00: граница 16:59 / 17:00 / 17:01', () => {
  it('в 16:59 не зачисляется, в 17:00 — один раз, в 17:01 повторный проход ничего не добавляет', async () => {
    expect(minutesOfDay(at('16:59'))).toBe(INCOME_MINUTES - 1);
    expect(await autoIncomeTick(at('16:59'))).toBe(0);
    expect(await salaryTxs()).toHaveLength(0);

    expect(await autoIncomeTick(at('17:00'))).toBe(1);
    const [tx] = await salaryTxs();
    expect(tx).toMatchObject({ type: 'income', amount: 6_000_000, date: DAY, createdAt: at('17:00') });

    expect(await autoIncomeTick(at('17:01'))).toBe(0);
    expect(await salaryTxs()).toHaveLength(1);
    expect(await statusOfSalary()).toBe('done');
  });

  it('два прохода в 17:00 одновременно (две перерисовки) — одна операция', async () => {
    const tick = () => autoCompleteIncome(salary, DAY, at('17:00'));
    const results = await Promise.all([tick(), tick()]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await salaryTxs()).toHaveLength(1);
  });

  it('«Пришло» в окне, открытом до 17:00, после автозачисления — не пишет второй раз', async () => {
    expect(await autoIncomeTick(at('16:59'))).toBe(0); // окно открыто, дохода ещё нет
    await autoIncomeTick(at('17:00')); // зачислилось само
    const manual = await completeOccurrence(salary, DAY, { amount: 6_000_000, accountId: 'mbank', date: DAY });
    expect(manual).toBeNull();
    expect(await salaryTxs()).toHaveLength(1);
    expect(await db.occurrenceLog.count()).toBe(1);
  });

  it('«Пропустить» после автозачисления — наступление остаётся «сделано», операция на месте', async () => {
    await autoIncomeTick(at('17:00'));
    expect(await skipOccurrence('salary', DAY)).toBeNull();
    expect(await statusOfSalary()).toBe('done');
    expect(await salaryTxs()).toHaveLength(1);
  });

  it('«Уже пришло» в 16:59 — в 17:00 само не зачисляется второй раз', async () => {
    const manual = await completeOccurrence(salary, DAY, { amount: 6_000_000, accountId: 'mbank', date: DAY });
    expect(manual).not.toBeNull();
    expect(await autoIncomeTick(at('17:00'))).toBe(0);
    expect(await autoIncomeTick(at('17:01'))).toBe(0);
    expect(await salaryTxs()).toHaveLength(1);
  });

  it('двойной тап «Оплачено» — одна операция', async () => {
    const pay = () => completeOccurrence(salary, DAY, { amount: 6_000_000, accountId: 'mbank', date: DAY });
    const results = await Promise.all([pay(), pay()]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await salaryTxs()).toHaveLength(1);
  });
});
