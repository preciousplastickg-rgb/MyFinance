import type { LocalDate } from './types';

export const TIME_ZONE = 'Asia/Bishkek';

const localDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Календарная дата момента времени в Бишкеке. */
export function toLocalDate(at: Date | number): LocalDate {
  const parts = localDateFormat.formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Минуты с начала дня по Бишкеку: 17:00 → 1020. */
export function minutesOfDay(at: Date | number): number {
  const parts = timeFormat.formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

/** Момент «дата, ЧЧ:ММ по Бишкеку» (UTC+6 круглый год, без перехода на летнее время). */
export function bishkekTime(date: LocalDate, minutes: number): number {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return Date.parse(`${date}T${hh}:${mm}:00+06:00`);
}

export function parseLocalDate(date: LocalDate): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Некорректная дата: ${date}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** День недели: 1 = пн … 7 = вс. */
export function weekdayOf(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  const js = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return js === 0 ? 7 : js;
}

const WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const MONTHS_NOMINATIVE = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/** «Среда, 4 ноября» — шапка экрана «Сегодня». */
export function formatDayHeader(date: LocalDate): string {
  const { month, day } = parseLocalDate(date);
  const weekday = WEEKDAYS[weekdayOf(date) - 1]!;
  return `${weekday[0]!.toUpperCase()}${weekday.slice(1)}, ${day} ${MONTHS_GENITIVE[month - 1]}`;
}

/** «Ноябрь 2026». */
export function formatMonthTitle(date: LocalDate): string {
  const { year, month } = parseLocalDate(date);
  return `${MONTHS_NOMINATIVE[month - 1]} ${year}`;
}

function fromUtc(ms: number): LocalDate {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toUtc(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return Date.UTC(year, month - 1, day);
}

const DAY_MS = 86_400_000;

export function makeDate(year: number, month: number, day: number): LocalDate {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Сколько дней от a до b (b − a). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** День 29–31 в коротком месяце сдвигается на последний день месяца. */
export function clampedDate(year: number, month: number, day: number): LocalDate {
  return makeDate(year, month, Math.min(day, daysInMonth(year, month)));
}

export function endOfMonth(date: LocalDate): LocalDate {
  const { year, month } = parseLocalDate(date);
  return makeDate(year, month, daysInMonth(year, month));
}

/** 'YYYY-MM' */
export type MonthKey = string;

export function monthOf(date: LocalDate): MonthKey {
  return date.slice(0, 7);
}

export function addMonths(month: MonthKey, n: number): MonthKey {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

export function monthRange(month: MonthKey): { from: LocalDate; to: LocalDate } {
  const from = `${month}-01`;
  return { from, to: endOfMonth(from) };
}

const MONTHS_PREPOSITIONAL = [
  'январе', 'феврале', 'марте', 'апреле', 'мае', 'июне',
  'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре',
];

/** «Октябрь 2026» по ключу месяца. */
export function formatMonthKey(month: MonthKey): string {
  return formatMonthTitle(`${month}-01`);
}

/** «октябре» — для «в октябре». */
export function monthPrepositional(month: MonthKey): string {
  return MONTHS_PREPOSITIONAL[Number(month.slice(5, 7)) - 1]!;
}

/** «Окт» — подписи столбцов. */
export function monthShort(month: MonthKey): string {
  return formatMonthKey(month).slice(0, 3);
}

/** «2 ноября». */
export function formatShortDate(date: LocalDate): string {
  const { month, day } = parseLocalDate(date);
  return `${day} ${MONTHS_GENITIVE[month - 1]}`;
}

/** «Сегодня», «Завтра», «Вчера» или «2 ноября». */
export function formatRelativeDate(date: LocalDate, today: LocalDate): string {
  const d = diffDays(today, date);
  if (d === 0) return 'Сегодня';
  if (d === 1) return 'Завтра';
  if (d === -1) return 'Вчера';
  return formatShortDate(date);
}

/** «Пятница, 6 ноября»; для сегодня/завтра/вчера — «Завтра, 5 ноября». */
export function formatDayTitle(date: LocalDate, today: LocalDate): string {
  const d = diffDays(today, date);
  if (d === 0) return `Сегодня, ${formatShortDate(date)}`;
  if (d === 1) return `Завтра, ${formatShortDate(date)}`;
  if (d === -1) return `Вчера, ${formatShortDate(date)}`;
  return formatDayHeader(date);
}
