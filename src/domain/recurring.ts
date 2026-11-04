import type { RecurringSchedule } from './types';

const WEEKDAYS_PLURAL = ['понедельникам', 'вторникам', 'средам', 'четвергам', 'пятницам', 'субботам', 'воскресеньям'];
const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** «10-го числа», «по понедельникам», «1 марта каждый год». */
export function describeSchedule(s: RecurringSchedule): string {
  if (s.type === 'monthly') return `${s.day}-го числа`;
  if (s.type === 'weekly') return `по ${WEEKDAYS_PLURAL[s.weekday - 1]}`;
  return `${s.day} ${MONTHS_GENITIVE[s.month - 1]} каждый год`;
}
