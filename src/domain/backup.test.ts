import { describe, expect, it } from 'vitest';
import { generateSeed } from '../dev/seedData';
import { BACKUP_SCHEMA_VERSION, backupBanner, backupFileName, buildBackup, parseBackup, transactionsCsv, type Backup } from './backup';

const seed = generateSeed('2026-11-04');
const backup: Backup = buildBackup(
  {
    accounts: seed.accounts, categories: seed.categories, transactions: seed.transactions, recurring: seed.recurring,
    occurrenceLog: seed.occurrenceLog, settings: [seed.settings], areas: [], tasks: [], taskEvents: [],
    habits: [], habitLogs: [], exercises: [], workouts: [], workoutSets: [], debts: seed.debts, goals: [],
  },
  Date.parse('2026-11-02T12:00:00+06:00'),
);

describe('бэкап JSON', async () => {
  it('имя файла', async () => {
    expect(backupFileName('2026-11-04')).toBe('finance-backup-2026-11-04.json');
  });
  it('экспорт → импорт без потерь', async () => {
    const r = await parseBackup(JSON.stringify(backup));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup).toEqual(backup);
  });
  it('превью', async () => {
    const r = await parseBackup(JSON.stringify(backup));
    expect(r.ok && r.summary).toBe(`Счетов 5, операций ${seed.transactions.length.toLocaleString('ru-RU').replace(/\s/g, ' ')}, задач 0, бэкап от 2 ноября`);
  });
  it('неизвестные поля сохраняются', async () => {
    const extra = { ...backup, data: { ...backup.data, accounts: backup.data.accounts.map((a) => ({ ...a, future: 1 })) } };
    const r = await parseBackup(JSON.stringify(extra));
    expect(r.ok && (r.backup.data.accounts[0] as unknown as { future: number }).future).toBe(1);
  });
  it('ошибки понятны', async () => {
    expect(await parseBackup('{')).toEqual({ ok: false, error: 'Это не JSON-файл' });
    expect(await parseBackup('{"a":1}')).toEqual({ ok: false, error: 'Это не бэкап этого приложения' });
    expect(await parseBackup(JSON.stringify({ ...backup, schemaVersion: 99 }))).toMatchObject({ ok: false, error: expect.stringContaining('более новой') });
    const broken = { ...backup, data: { ...backup.data, transactions: [{ ...backup.data.transactions[0], amount: 1.5 }] } };
    expect(await parseBackup(JSON.stringify(broken))).toMatchObject({ ok: false, error: expect.stringContaining('transactions.0.amount') });
  });
  it('бэкап без palette и fabPosition (до этапа 26) импортируется; с ними — значения сохраняются', async () => {
    const r = await parseBackup(JSON.stringify(backup));
    expect(r.ok && r.backup.data.settings[0]).not.toHaveProperty('palette');
    expect(r.ok && r.backup.data.settings[0]).not.toHaveProperty('fabPosition');
    const styled = { ...backup, data: { ...backup.data, settings: [{ ...backup.data.settings[0], palette: 'navy', fabPosition: 'center' }] } };
    const r2 = await parseBackup(JSON.stringify(styled));
    expect(r2.ok && r2.backup.data.settings[0]).toMatchObject({ palette: 'navy', fabPosition: 'center' });
    const bad = { ...backup, data: { ...backup.data, settings: [{ ...backup.data.settings[0], palette: 'neon' }] } };
    expect(await parseBackup(JSON.stringify(bad))).toMatchObject({ ok: false, error: expect.stringContaining('settings.0.palette') });
  });
  it('раскладка главной (2026-11-09): без неё бэкап импортируется, с ней — порядок и скрытые сохраняются', async () => {
    const r = await parseBackup(JSON.stringify(backup));
    expect(r.ok && r.backup.data.settings[0]).not.toHaveProperty('homeLayout');
    const homeLayout = { order: ['tasks', 'money', 'weather'], hidden: ['habits'] };
    const laid = { ...backup, data: { ...backup.data, settings: [{ ...backup.data.settings[0], homeLayout }] } };
    const r2 = await parseBackup(JSON.stringify(laid));
    expect(r2.ok && r2.backup.data.settings[0]).toMatchObject({ homeLayout });
    const bad = { ...backup, data: { ...backup.data, settings: [{ ...backup.data.settings[0], homeLayout: { order: 'tasks' } }] } };
    expect(await parseBackup(JSON.stringify(bad))).toMatchObject({ ok: false, error: expect.stringContaining('settings.0.homeLayout') });
  });
  it('файл схемы v1 проходит миграцию на v2 без потерь', async () => {
    const { habits: _h, habitLogs: _l, exercises: _e, workouts: _w, workoutSets: _s, ...v1data } = backup.data;
    const r = await parseBackup(JSON.stringify({ ...backup, schemaVersion: 1, data: v1data }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
      expect(r.backup.data).toEqual(backup.data);
    }
  });
  it('файл v2 с курсом USDT старого формата: курс переезжает в rates.USDT', async () => {
    const old = { ...backup, schemaVersion: 2, data: { ...backup.data, settings: [{ key: 'main', smallExpenseThreshold: 30_000, theme: 'system', lastUsdtRate: 875_000, lastUsdtRateDate: '2026-10-27' }] } };
    const r = await parseBackup(JSON.stringify(old));
    expect(r.ok && r.backup.data.settings[0]).toEqual({
      key: 'main', smallExpenseThreshold: 30_000, theme: 'system', lastUsdtRate: 875_000, lastUsdtRateDate: '2026-10-27',
      rates: { USDT: { rate: 875_000, date: '2026-10-27' } },
    });
  });
  it('файл v3 с тренировками: дни тренировок становятся отметками привычки, тренировки остаются', async () => {
    const gym = { id: 'gym', name: 'Спортзал', icon: 'Dumbbell', color: 'blue', kind: 'weekly' as const, target: 3, workoutType: 'gym' as const, startDate: '2026-10-01', sortOrder: 0, archived: false };
    const workouts = [{ id: 'w1', date: '2026-11-02', type: 'gym' as const, createdAt: 1, updatedAt: 1 }];
    const v3 = { ...backup, schemaVersion: 3, data: { ...backup.data, habits: [gym], workouts } };
    const r = await parseBackup(JSON.stringify(v3));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(r.backup.data.workouts).toEqual(workouts);
    expect(r.backup.data.habits).toEqual([{ ...gym, kind: 'daily', legacyKind: 'weekly', days: [1, 3, 5] }]);
    expect(r.backup.data.habitLogs).toEqual([{ id: 'workout-gym-2026-11-02', habitId: 'gym', date: '2026-11-02', value: 1, at: 1 }]);
  });
  it('файл v4: «дни без» становятся галочками по день экспорта, срыв остаётся со значением 0', async () => {
    const sugar = { id: 'sugar', name: 'Без сахара', icon: 'Ban', color: 'rose', kind: 'abstain' as const, startDate: '2026-11-01', sortOrder: 0, archived: false };
    const relapse = { id: 'r', habitId: 'sugar', date: '2026-11-02', value: 1, at: 1 };
    const exportedAt = new Date('2026-11-04T10:00:00+06:00').getTime();
    const r = await parseBackup(JSON.stringify({ ...backup, schemaVersion: 4, exportedAt, data: { ...backup.data, habits: [sugar], habitLogs: [relapse] } }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.data.habits).toEqual([{ ...sugar, kind: 'daily', legacyKind: 'abstain' }]);
    expect(r.backup.data.habitLogs.map((l) => [l.date, l.value])).toEqual([
      ['2026-11-02', 0],
      ['2026-11-01', 1],
      ['2026-11-03', 1],
      ['2026-11-04', 1],
    ]);
  });
  it('файл v5 без долгов открывается, долги пустые; операция долга без долга не импортируется', async () => {
    const { debts: _d, ...rest } = backup.data;
    const v5data = { ...rest, transactions: rest.transactions.filter((t) => t.type !== 'debt') };
    const r = await parseBackup(JSON.stringify({ ...backup, schemaVersion: 5, data: v5data }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup.data.debts).toEqual([]);
    const orphan = { ...backup.data.transactions[0]!, id: 'd', type: 'debt', debtId: 'нет-такого', flow: 'out' };
    expect(await parseBackup(JSON.stringify({ ...backup, data: { ...backup.data, transactions: [...backup.data.transactions, orphan] } }))).toMatchObject({ ok: false });
    const ok = { ...orphan, debtId: 'debt-azamat' };
    expect((await parseBackup(JSON.stringify({ ...backup, data: { ...backup.data, transactions: [...backup.data.transactions, ok] } }))).ok).toBe(true);
  });
  it('копилка (этап 20) проходит проверку; файл v6 открывается как есть', async () => {
    const jar = { ...backup.data.accounts[0]!, id: 'edu', type: 'savings', includeInDaily: false, purpose: 'fund', goal: 10_000_000, goalDate: '2027-03-15' };
    expect((await parseBackup(JSON.stringify({ ...backup, data: { ...backup.data, accounts: [...backup.data.accounts, jar] } }))).ok).toBe(true);
    const r = await parseBackup(JSON.stringify({ ...backup, schemaVersion: 6 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup.data.accounts).toEqual(backup.data.accounts);
  });
  it('долг «Только запомнить» с отметками без счёта (2026-11-09) проходит проверку и сохраняется; кривая отметка — нет', async () => {
    const memo = {
      id: 'memo', direction: 'iOwe', person: 'Налог', currency: 'KGS', opening: 1_200_000, date: '2026-11-01', createdAt: 1, memo: true,
      marks: [{ id: 'k', kind: 'repay', amount: 200_000, date: '2026-11-05', createdAt: 2 }],
    };
    const r = await parseBackup(JSON.stringify({ ...backup, data: { ...backup.data, debts: [...backup.data.debts, memo] } }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup.data.debts.find((d) => d.id === 'memo')).toEqual(memo);
    const bad = { ...memo, marks: [{ ...memo.marks[0], amount: -1 }] };
    expect((await parseBackup(JSON.stringify({ ...backup, data: { ...backup.data, debts: [bad] } }))).ok).toBe(false);
  });

  it('лимит категории (этап 23) проходит проверку; файл v9 открывается как есть (v10)', async () => {
    const limited = { ...backup.data.categories[0]!, limit: 600_000 };
    const r = await parseBackup(JSON.stringify({ ...backup, schemaVersion: 9, data: { ...backup.data, categories: [limited] } }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
      expect(r.backup.data.categories[0]).toEqual(limited);
    }
    expect((await parseBackup(JSON.stringify({ ...backup, data: { ...backup.data, categories: [{ ...limited, limit: -1 }] } }))).ok).toBe(false);
  });
  it('файл v10: цели получают порядок по дате создания; дедлайн и стоимость дела проходят проверку (v11)', async () => {
    const goals = [
      { id: 'g2', name: 'Машина', icon: 'Car', color: 'blue', createdAt: 20 },
      { id: 'g1', name: 'Отпуск', icon: 'Plane', color: 'rose', createdAt: 10 },
    ];
    const task = { id: 't', title: 'Билеты', important: false, status: 'open', postponeCount: 0, createdAt: 1, deadline: '2026-12-01', cost: 4_500_000, costCurrency: 'KGS' };
    const r = await parseBackup(JSON.stringify({ ...backup, schemaVersion: 10, data: { ...backup.data, goals, tasks: [task] } }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
      expect(r.backup.data.goals.map((g) => [g.id, g.sortOrder])).toEqual([['g2', 1], ['g1', 0]]);
      expect(r.backup.data.tasks[0]).toMatchObject({ deadline: '2026-12-01', cost: 4_500_000 });
    }
    const bad = { ...backup, data: { ...backup.data, tasks: [{ ...task, deadline: '1 декабря' }] } };
    expect((await parseBackup(JSON.stringify(bad))).ok).toBe(false);
  });
  it('кредит у регулярного платежа проходит проверку, пустой календарь — нет (v11)', async () => {
    const r0 = backup.data.recurring[0] ?? {
      id: 'r', kind: 'expense', name: 'Кредит', amount: 500_000, currency: 'KGS', accountId: backup.data.accounts[0]!.id, categoryId: backup.data.categories[0]!.id,
      schedule: { type: 'monthly', day: 6 }, isMandatory: true, isSubscription: false, startDate: '2026-11-06', active: true,
    };
    const loan = { kind: 'credit', principal: 1_000_000, rate: 2400, termMonths: 2, firstDate: '2026-11-06', payments: [{ date: '2026-11-06', amount: 500_000 }, { date: '2026-12-06', amount: 520_000 }] };
    const ok = await parseBackup(JSON.stringify({ ...backup, data: { ...backup.data, recurring: [{ ...r0, loan }] } }));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.backup.data.recurring[0]!.loan?.payments).toHaveLength(2);
    const bad = await parseBackup(JSON.stringify({ ...backup, data: { ...backup.data, recurring: [{ ...r0, loan: { ...loan, payments: [] } }] } }));
    expect(bad.ok).toBe(false);
  });
  it('файл v8 без целей открывается: goals — пустой список (v9)', async () => {
    const { goals: _g, ...rest } = backup.data as typeof backup.data & { goals?: unknown };
    const r = await parseBackup(JSON.stringify({ ...backup, schemaVersion: 8, data: rest }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup.data.goals).toEqual([]);
  });
  it('файл v7: hex-цвета переводятся в имена токенов (v8)', async () => {
    const old = { ...backup, schemaVersion: 7, data: { ...backup.data, categories: [{ ...backup.data.categories[0]!, color: '#B45309' }] } };
    const r = await parseBackup(JSON.stringify(old));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
      expect(r.backup.data.categories[0]!.color).toBe('orange');
    }
  });
  it('счета в USD и EUR проходят проверку', async () => {
    const multi = { ...backup, data: { ...backup.data, accounts: [...backup.data.accounts, { ...backup.data.accounts[0]!, id: 'usd', currency: 'USD' }] } };
    expect((await parseBackup(JSON.stringify(multi))).ok).toBe(true);
  });
  it('операция на несуществующий счёт и перевод без получателя не импортируются', async () => {
    const [first, ...rest] = backup.data.transactions;
    const orphan = { ...backup, data: { ...backup.data, transactions: [{ ...first!, accountId: 'нет-такого' }, ...rest] } };
    const r1 = await parseBackup(JSON.stringify(orphan));
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).toBe('Файл повреждён: data.transactions.0.accountId — счёт не найден');
    const transfer = rest.find((t) => t.type === 'transfer')!;
    const noTarget = { ...transfer };
    delete noTarget.toAccountId;
    const r2 = await parseBackup(JSON.stringify({ ...backup, data: { ...backup.data, transactions: [noTarget] } }));
    expect(r2.ok).toBe(false);
  });
  it('таблицы фазы 2 необязательны (старые файлы)', async () => {
    const { areas: _a, tasks: _t, taskEvents: _e, ...rest } = backup.data;
    const r = await parseBackup(JSON.stringify({ ...backup, data: rest }));
    expect(r.ok && r.backup.data.tasks).toEqual([]);
  });
});

describe('CSV для Excel', () => {
  const acc = seed.accounts;
  const usdt = acc.find((a) => a.currency === 'USDT')!;
  const mbank = acc.find((a) => a.name === 'MBank')!;
  const csv = transactionsCsv(
    [
      { id: '1', type: 'expense', date: '2026-11-02', accountId: mbank.id, amount: 25_000, categoryId: seed.categories[1]!.id, note: 'обед; с "коллегами"', createdAt: 1, updatedAt: 1 },
      { id: '2', type: 'transfer', date: '2026-11-03', accountId: usdt.id, amount: 20_000, toAccountId: mbank.id, toAmount: 1_750_000, rate: 875_000, createdAt: 2, updatedAt: 2 },
      // Комментарий, похожий на формулу Excel, — экранируется апострофом (CSV injection).
      { id: '3', type: 'expense', date: '2026-11-04', accountId: mbank.id, amount: 100, categoryId: seed.categories[1]!.id, note: '=1+1', createdAt: 3, updatedAt: 3 },
    ],
    acc,
    seed.categories,
  );
  it('BOM, «;», десятичная запятая, экранирование кавычек и формул', () => {
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'дата;тип;сумма;валюта;счёт;категория;счёт_получатель;сумма_зачисления;курс;комментарий',
      '2026-11-02;расход;250,00;KGS;MBank;Кафе;;;;"обед; с ""коллегами"""',
      '2026-11-03;перевод;200,00;USDT;USDT;;MBank;17500,00;87,5000;',
      "2026-11-04;расход;1,00;KGS;MBank;Кафе;;;;'=1+1",
      '',
    ]);
  });
});

describe('баннер бэкапа', () => {
  const now = Date.parse('2026-11-04T12:00:00+06:00');
  const day = 86_400_000;
  it('меньше 20 операций — нет', () => {
    expect(backupBanner({ transactionCount: 19, now })).toEqual({ show: false });
  });
  it('бэкапа не было', () => {
    expect(backupBanner({ transactionCount: 20, now })).toEqual({ show: true, text: 'Бэкапа ещё не было' });
  });
  it('старше 7 дней', () => {
    expect(backupBanner({ transactionCount: 50, lastBackupAt: now - 9 * day, now })).toEqual({ show: true, text: 'Последний бэкап 9 дней назад' });
    expect(backupBanner({ transactionCount: 50, lastBackupAt: now - 6 * day, now })).toEqual({ show: false });
  });
  it('закрыт на 24 часа', () => {
    expect(backupBanner({ transactionCount: 50, now, hiddenUntil: now + 1000 })).toEqual({ show: false });
    expect(backupBanner({ transactionCount: 50, now, hiddenUntil: now - 1000 }).show).toBe(true);
  });
});
