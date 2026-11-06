import { it } from 'vitest';
import { generateSeed } from './dev/seedData';
import { monthReport } from './domain/reports';
import { taskLists, periodStats } from './domain/tasks';
import { toLocalDate } from './domain/date';
import { debtsOverview } from './domain/debts';
import { habitView } from './domain/habits';
import { rateBook } from './domain/rate';
import type { Task, TaskEvent, Transaction, Debt, Habit, HabitLog } from './domain/types';

const TODAY = '2026-11-04';
const seed = generateSeed(TODAY);
// 10 000 операций: сид за 3 месяца, размноженный со сдвигом по месяцам.
const txs: Transaction[] = [];
let k = 0;
while (txs.length < 10_000) {
  for (const t of seed.transactions) {
    const y = Number(t.date.slice(0, 4)) - Math.floor(k / 4);
    txs.push({ ...t, id: `${t.id}-${k}`, date: `${y}${t.date.slice(4)}`, createdAt: t.createdAt - k });
    if (txs.length >= 10_000) break;
  }
  k++;
}
const accountById = new Map(seed.accounts.map((a) => [a.id, a]));
const categoryById = new Map(seed.categories.map((c) => [c.id, c]));
const rates = rateBook(txs, accountById, seed.settings);
const debts: Debt[] = Array.from({ length: 20 }, (_, i) => ({ id: `d${i}`, direction: 'owedToMe', person: `P${i}`, currency: 'KGS', opening: 0, date: '2026-10-01', createdAt: i }));
for (let i = 0; i < 200; i++) txs.push({ id: `dt${i}`, type: 'debt', debtId: `d${i % 20}`, flow: i % 3 ? 'out' : 'in', date: '2026-10-05', accountId: seed.accounts[0]!.id, amount: 1000, createdAt: i, updatedAt: i });
const tasks: Task[] = [];
const events: TaskEvent[] = [];
const base = Date.parse('2026-01-01T10:00:00+06:00');
for (let i = 0; i < 3000; i++) {
  const at = base + i * 3_600_000 * 2;
  const date = toLocalDate(at);
  const done = i % 3 !== 0;
  tasks.push({ id: `t${i}`, title: `T${i}`, important: false, status: done ? 'done' : 'open', postponeCount: 0, createdAt: at, date, ...(done ? { doneAt: at + 1000 } : {}), areaId: `a${i % 4}` });
  events.push({ id: `e${i}`, taskId: `t${i}`, type: 'created', date, at, toDate: date });
  if (done) events.push({ id: `ed${i}`, taskId: `t${i}`, type: 'done', date, at: at + 1000 });
}
const habits: Habit[] = Array.from({ length: 10 }, (_, i) => ({ id: `h${i}`, name: `H${i}`, icon: 'Star', color: 'blue', kind: 'daily', startDate: '2026-01-01', sortOrder: i, archived: false }));
const logs: HabitLog[] = [];
for (let i = 0; i < 300; i++) for (const h of habits) logs.push({ id: `${h.id}-${i}`, habitId: h.id, date: toLocalDate(base + i * 86_400_000), value: 1, at: i });

function bench(name: string, fn: () => unknown, n = 20) {
  fn();
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn();
  console.log(`${name}: ${((performance.now() - t0) / n).toFixed(2)} ms`);
}

it('perf', () => {
  console.log(`tx=${txs.length} tasks=${tasks.length} events=${events.length} logs=${logs.length}`);
  bench('monthReport', () => monthReport({ month: '2026-10', today: TODAY, transactions: txs, accountById, categoryById, recurring: seed.recurring, rates, settings: seed.settings }));
  bench('taskLists', () => taskLists(tasks, TODAY, events));
  bench('periodStats month', () => periodStats('month', TODAY, TODAY, tasks, events));
  bench('toLocalDate x30k', () => { for (let i = 0; i < 30_000; i++) toLocalDate(base + i * 1000); }, 5);
  bench('debtsOverview', () => debtsOverview(debts, txs, TODAY));
  bench('habitViews x10', () => habits.map((h) => habitView(h, logs, TODAY)));
});
