import { addDays, diffDays, formatShortDate, parseLocalDate } from './date';
import { plural } from './money';
import { monthsUntil } from './savings';
import type { Goal, Id, LocalDate, Minor, Task } from './types';

export const GOAL_ICONS = ['Plane', 'House', 'Car', 'GraduationCap', 'Dumbbell', 'Heart', 'Laptop', 'Baby', 'BookOpen', 'Mountain', 'Gift', 'PiggyBank'] as const;
export const GOAL_COLORS = ['rose', 'blue', 'violet', 'green', 'amber', 'teal'] as const;

export type DuePreset = '3m' | '6m' | '1y' | 'none';
export const DUE_PRESETS: readonly { id: DuePreset; label: string }[] = [
  { id: '3m', label: '3 месяца' },
  { id: '6m', label: 'Полгода' },
  { id: '1y', label: 'Год' },
  { id: 'none', label: 'Без срока' },
];

/** Срок по пресету: то же число через N месяцев (31 мая + 1 мес → 30 июня). */
export function dueFromPreset(today: LocalDate, preset: DuePreset): LocalDate | undefined {
  if (preset === 'none') return undefined;
  const months = preset === '3m' ? 3 : preset === '6m' ? 6 : 12;
  const { year, month, day } = parseLocalDate(today);
  const m0 = month - 1 + months;
  const y = year + Math.floor(m0 / 12);
  const m = (m0 % 12) + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const d = Math.min(day, last);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export interface GoalPart {
  key: 'money' | 'habits' | 'tasks';
  label: string;
  /** 0–1 */
  frac: number;
  value: string;
}

export interface GoalProgress {
  parts: GoalPart[];
  /** 0–1, среднее по частям; нет частей — 0. */
  frac: number;
  percent: number;
}

/**
 * Прогресс цели (goalView из прототипа): деньги = накоплено / цель, привычки = средний % связанных,
 * дела = выполнено / всего. Части без данных не участвуют.
 */
export function goalProgress(input: { jar?: { balance: Minor; target: Minor }; habitRates: readonly number[]; tasks: readonly Pick<Task, 'status'>[] }): GoalProgress {
  const parts: GoalPart[] = [];
  if (input.jar && input.jar.target > 0) {
    const frac = Math.min(1, input.jar.balance / input.jar.target);
    parts.push({ key: 'money', label: 'Деньги', frac, value: `${Math.round(frac * 100)}%` });
  }
  if (input.habitRates.length) {
    const r = input.habitRates.reduce((a, b) => a + Math.min(100, b), 0) / input.habitRates.length;
    parts.push({ key: 'habits', label: 'Привычки', frac: r / 100, value: `${Math.round(r)}%` });
  }
  const tasks = input.tasks.filter((t) => t.status !== 'deleted');
  if (tasks.length) {
    const done = tasks.filter((t) => t.status === 'done').length;
    parts.push({ key: 'tasks', label: 'Дела', frac: done / tasks.length, value: `${done} из ${tasks.length}` });
  }
  const frac = parts.length ? parts.reduce((a, p) => a + p.frac, 0) / parts.length : 0;
  return { parts, frac, percent: Math.round(frac * 100) };
}

/** «деньги 38% · привычки 61% · дела 1 из 3», без частей — «пока пусто». */
export function partsLine(p: GoalProgress): string {
  return p.parts.map((x) => `${x.label.toLowerCase()} ${x.value}`).join(' · ') || 'пока пусто';
}

/** «копилка, 1 привычка, 3 дела», без связей — «ничего не связано». */
export function linksLine(hasJar: boolean, habits: number, tasks: number): string {
  return (
    [hasJar && 'копилка', habits > 0 && `${habits} ${plural(habits, ['привычка', 'привычки', 'привычек'])}`, tasks > 0 && `${tasks} ${plural(tasks, ['дело', 'дела', 'дел'])}`]
      .filter(Boolean)
      .join(', ') || 'ничего не связано'
  );
}

/** «до 15 марта»; без срока — «без срока». */
export function dueLabel(dueDate: LocalDate | undefined): string {
  return dueDate ? `до ${formatShortDate(dueDate)}` : 'без срока';
}

/** «осталось 4 месяца» / «осталось 8 недель» / «осталось 5 дней» / «срок прошёл». */
export function leftLabel(today: LocalDate, dueDate: LocalDate | undefined): string {
  if (!dueDate) return '';
  const days = diffDays(today, dueDate);
  if (days < 0) return 'срок прошёл';
  if (days === 0) return 'последний день';
  if (days >= 60) {
    const m = Math.round(days / 30);
    return `осталось ${m} ${plural(m, ['месяц', 'месяца', 'месяцев'])}`;
  }
  if (days >= 14) {
    const w = Math.round(days / 7);
    return `осталось ${w} ${plural(w, ['неделя', 'недели', 'недель'])}`;
  }
  return `осталось ${days} ${plural(days, ['день', 'дня', 'дней'])}`;
}

/** Сколько откладывать в месяц, чтобы успеть к сроку: вверх до 10 сом. Без срока — за 12 месяцев. */
export function perMonth(left: Minor, today: LocalDate, dueDate: LocalDate | undefined): Minor {
  const months = dueDate ? monthsUntil(today, dueDate) : 12;
  return Math.ceil(left / months / 1000) * 1000;
}

/** Ближайшая активная цель — для подписи «сейчас ведёт к …» при привязке. */
export function goalById(goals: readonly Goal[]): Map<Id, Goal> {
  return new Map(goals.map((g) => [g.id, g]));
}

/** Короткое имя для чипа: первое слово до 10 символов («Отпуск в Стамбуле» → «Отпуск»). */
export function shortName(name: string): string {
  return name.trim().split(/\s+/)[0]!.slice(0, 10);
}

export { addDays };
