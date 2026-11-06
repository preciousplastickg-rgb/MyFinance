// Тестовые данные за 3 месяца для `npm run seed` (только dev) и для тестов отчётов.
import { BASE_CATEGORIES, DEFAULT_ACCOUNTS } from '../domain/catalog';
import { addDays, monthOf, weekdayOf } from '../domain/date';
import { HABIT_TEMPLATES } from '../domain/habits';
import { occurrenceDates } from '../domain/recurring';
import type {
  Goal, Account, Category, Debt, Habit, HabitLog, OccurrenceLog, Recurring, Settings, Transaction } from '../domain/types';

export interface SeedData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurring: Recurring[];
  occurrenceLog: OccurrenceLog[];
  settings: Settings;
  habits: Habit[];
  habitLogs: HabitLog[];
  debts: Debt[];
  goals: Goal[];
}

/** Детерминированный ГПСЧ, чтобы seed и тесты были воспроизводимы. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSeed(today: string, seed = 42): SeedData {
  const rnd = mulberry32(seed);
  const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
  const som = (min: number, max: number, step = 10) => Math.round(int(min, max) / step) * step * 100;
  const start = addDays(today, -92);
  let createdAt = Date.parse(`${start}T08:00:00+06:00`);
  const id = (p: string) => `${p}-${(createdAt++).toString(36)}`;

  const categories: Category[] = BASE_CATEGORIES.map((c, i) => ({ ...c, id: `cat-${i}`, sortOrder: i, archived: false }));
  const cat = (name: string) => categories.find((c) => c.name === name)!.id;
  // Лимиты в месяц (этап 23): «Кафе» на seed-данных обычно сверх лимита, «Продукты» — в рамках.
  for (const [name, limit] of [['Кафе', 600_000], ['Продукты', 2_500_000], ['Транспорт', 400_000], ['Развлечения', 500_000]] as const) {
    categories.find((c) => c.name === name)!.limit = limit;
  }

  const openings: Record<string, number> = { MBank: 1_500_000, 'О!Банк': 500_000, Оптима: 300_000, Наличные: 400_000, USDT: 30_000 };
  const accounts: Account[] = DEFAULT_ACCOUNTS.map((a, i) => ({
    ...a, id: `acc-${i}`, openingBalance: openings[a.name] ?? 0, openingDate: start, sortOrder: i, archived: false,
  }));
  const acc = (name: string) => accounts.find((a) => a.name === name)!.id;

  const rec = (r: Omit<Recurring, 'id' | 'startDate' | 'active' | 'isSubscription' | 'isMandatory'> & Partial<Recurring>, key: string): Recurring => ({
    id: `rec-${key}`, startDate: start, active: true, isSubscription: false, isMandatory: r.kind === 'expense', ...r,
  });
  const recurring: Recurring[] = [
    rec({ kind: 'income', name: 'Зарплата', amount: 6_500_000, currency: 'KGS', accountId: acc('MBank'), categoryId: cat('Зарплата'), schedule: { type: 'monthly', day: 10 }, isMandatory: false }, 'salary'),
    rec({ kind: 'income', name: 'Зарплата 2 (USDT)', amount: 50_000, currency: 'USDT', accountId: acc('USDT'), categoryId: cat('Подработка'), schedule: { type: 'monthly', day: 25 }, isMandatory: false }, 'salary2'),
    rec({ kind: 'expense', name: 'Аренда квартиры', amount: 1_500_000, currency: 'KGS', accountId: acc('MBank'), categoryId: cat('Жильё'), schedule: { type: 'monthly', day: 5 } }, 'rent'),
    rec({ kind: 'expense', name: 'Интернет', amount: 100_000, currency: 'KGS', accountId: acc('MBank'), categoryId: cat('Связь и интернет'), schedule: { type: 'monthly', day: 7 } }, 'internet'),
    rec({ kind: 'expense', name: 'Мобильная связь', amount: 50_000, currency: 'KGS', accountId: acc('О!Банк'), categoryId: cat('Связь и интернет'), schedule: { type: 'monthly', day: 8 } }, 'phone'),
    ...['Музыка', 'Кино', 'Облако', 'Нейросеть'].map((name, i) =>
      rec({ kind: 'expense', name, amount: 20_000, currency: 'KGS', accountId: acc('MBank'), categoryId: cat('Подписки'), schedule: { type: 'monthly', day: 12 + i * 4 }, isSubscription: true, isMandatory: false }, `sub${i}`),
    ),
  ];

  const transactions: Transaction[] = [];
  const occurrenceLog: OccurrenceLog[] = [];
  const add = (t: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => {
    const tx = { ...t, id: id('tx'), createdAt, updatedAt: createdAt };
    transactions.push(tx);
    return tx;
  };

  // Регулярные: прошедшие наступления оплачены в срок, кроме тех, что в будущем.
  for (const r of recurring) {
    for (const due of occurrenceDates(r, start, addDays(today, -1))) {
      const amount = r.kind === 'income' && r.currency === 'KGS' ? r.amount + som(-200, 200, 100) : r.amount;
      const tx = add({ type: r.kind, date: due, accountId: r.accountId, amount, categoryId: r.categoryId, note: r.name, recurringId: r.id, dueDate: due });
      occurrenceLog.push({ id: id('log'), recurringId: r.id, dueDate: due, status: 'done', transactionId: tx.id });
    }
  }

  // Повседневные траты. В последнем полном месяце кафе заметно больше — для карточки «Рост категории».
  const lastFullMonth = monthOf(addDays(`${monthOf(today)}-01`, -1));
  const daily: { name: string; p: number; min: number; max: number; step?: number; accounts: string[] }[] = [
    { name: 'Продукты', p: 0.55, min: 300, max: 2_400, accounts: ['MBank', 'Наличные', 'О!Банк'] },
    { name: 'Кафе', p: 0.4, min: 150, max: 650, accounts: ['MBank', 'Наличные'] },
    { name: 'Кафе', p: 0.5, min: 80, max: 250, accounts: ['Наличные', 'О!Банк'] },
    { name: 'Транспорт', p: 0.9, min: 40, max: 280, accounts: ['Наличные', 'О!Банк'] },
    { name: 'Продукты', p: 0.4, min: 60, max: 280, accounts: ['Наличные'] },
    { name: 'Здоровье', p: 0.05, min: 400, max: 3_000, accounts: ['MBank'] },
    { name: 'Одежда', p: 0.03, min: 1_500, max: 6_000, step: 100, accounts: ['Оптима', 'MBank'] },
    { name: 'Развлечения', p: 0.08, min: 300, max: 1_500, accounts: ['MBank'] },
    { name: 'Подарки', p: 0.02, min: 1_000, max: 4_000, step: 100, accounts: ['Оптима'] },
    { name: 'Дом', p: 0.05, min: 200, max: 2_500, accounts: ['MBank', 'Наличные'] },
    { name: 'Комиссии', p: 0.04, min: 10, max: 60, step: 5, accounts: ['MBank', 'О!Банк'] },
  ];
  for (let d = start; d <= today; d = addDays(d, 1)) {
    for (const k of daily) {
      const boost = k.name === 'Кафе' && monthOf(d) === lastFullMonth ? 1.8 : 1;
      if (rnd() < k.p * boost) {
        add({ type: 'expense', date: d, accountId: acc(k.accounts[int(0, k.accounts.length - 1)]!), amount: som(k.min, k.max, k.step), categoryId: cat(k.name) });
      }
    }
    if (rnd() < 0.03) add({ type: 'expense', date: d, accountId: acc('USDT'), amount: int(5, 25) * 100, categoryId: cat('Прочее'), note: 'Оплата картой USDT' });
    if (rnd() < 0.04) add({ type: 'income', date: d, accountId: acc('MBank'), amount: som(2_000, 8_000, 100), categoryId: cat('Подработка'), note: 'Фриланс' });
    // Каждую неделю — наличные из банкомата, раз в месяц — USDT → MBank.
    if (['-01', '-08', '-15', '-22'].some((x) => d.endsWith(x))) add({ type: 'transfer', date: d, accountId: acc('MBank'), amount: 500_000, toAccountId: acc('Наличные'), toAmount: 500_000 });
    if (d.endsWith('-11')) {
      add({ type: 'transfer', date: d, accountId: acc('MBank'), amount: 1_200_000, toAccountId: acc('О!Банк'), toAmount: 1_200_000 });
      add({ type: 'transfer', date: d, accountId: acc('MBank'), amount: 500_000, toAccountId: acc('Оптима'), toAmount: 500_000 });
    }
    if (d.endsWith('-27')) {
      const usdt = 30_000;
      const rate = 870_000 + int(0, 20) * 1_000;
      add({ type: 'transfer', date: d, accountId: acc('USDT'), amount: usdt, toAccountId: acc('MBank'), toAmount: Math.round((usdt * rate) / 10_000), rate });
    }
  }

  const habitStart = addDays(today, -60);
  const habits: Habit[] = HABIT_TEMPLATES.filter((t) => t.name !== 'Чтение').map((t, i) => ({
    ...t, kind: 'daily', id: `habit-${i}`, startDate: habitStart, sortOrder: i, archived: false,
  }));
  const habitLogs: HabitLog[] = [];
  for (let d = habitStart; d < today; d = addDays(d, 1)) {
    for (const h of habits) {
      // По расписанию — чаще, вне расписания — изредка.
      const due = !h.days || h.days.includes(weekdayOf(d));
      if (rnd() < (due ? 0.8 : 0.05)) habitLogs.push({ id: id('hl'), habitId: h.id, date: d, value: 1, at: createdAt });
    }
  }

  // Долги: Азамату дали 5 000 с MBank, вернул 2 000; Бакыту должны 10 000 — долг до приложения.
  const debts: Debt[] = [
    { id: 'debt-azamat', direction: 'owedToMe', person: 'Азамат', currency: 'KGS', opening: 0, date: addDays(today, -20), dueDate: addDays(today, 5), createdAt },
    { id: 'debt-bakyt', direction: 'iOwe', person: 'Бакыт', currency: 'KGS', opening: 1_000_000, date: addDays(today, -40), dueDate: addDays(today, 10), note: 'на ремонт', createdAt },
  ];
  transactions.push(
    { id: id('tx'), type: 'debt', debtId: 'debt-azamat', flow: 'out', date: addDays(today, -20), accountId: acc('MBank'), amount: 500_000, note: 'Азамат', createdAt, updatedAt: createdAt },
    { id: id('tx'), type: 'debt', debtId: 'debt-azamat', flow: 'in', date: addDays(today, -6), accountId: acc('MBank'), amount: 200_000, note: 'Азамат', createdAt, updatedAt: createdAt },
  );

  const lastRate = [...transactions].reverse().find((t) => t.rate);
  return {
    accounts, categories, transactions, recurring, occurrenceLog, habits, habitLogs, debts, goals: [],
    settings: {
      key: 'main', smallExpenseThreshold: 30_000, theme: 'system', onboardingDone: true,
      ...(lastRate ? { rates: { USDT: { rate: lastRate.rate!, date: lastRate.date } } } : {}),
    },
  };
}
