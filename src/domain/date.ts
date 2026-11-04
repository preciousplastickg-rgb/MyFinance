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
