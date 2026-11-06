import { useState } from 'react';
import { useToday } from '../../app/nav';
import { toggleHabitDay } from '../../data/habits';
import { formatMonthTitle, formatShortDate, parseLocalDate } from '../../domain/date';
import { bestStreak, calendarWeeks, currentStreak, rate30, scheduleLabel, streakUnit, type HabitView } from '../../domain/habits';
import { plural } from '../../domain/money';
import type { LocalDate } from '../../domain/types';
import { Button } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { DayMark } from './HabitCard';
import { HabitEditor } from './HabitEditor';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Серии, % за 30 дней, календарь 12 недель с правкой прошлых дней (SPEC 7a.1). */
export function HabitDetail({ view, onClose }: { view: HabitView; onClose: () => void }) {
  const today = useToday();
  const { habit } = view;
  const [editing, setEditing] = useState(false);
  const unit = streakUnit(habit);
  const current = currentStreak(view, today);
  const best = Math.max(bestStreak(view, today), current);
  const tiles = [
    { label: 'Серия', value: `${current}`, sub: plural(current, unit) },
    { label: 'Лучшая', value: `${best}`, sub: plural(best, unit) },
    { label: '30 дней', value: `${rate30(view, today)}%`, sub: 'выполнено' },
  ];

  const tapDay = (date: LocalDate) => {
    if (date > today || date < habit.startDate) return;
    void toggleHabitDay(habit, date);
  };

  if (editing) return <HabitEditor habit={habit} onClose={() => setEditing(false)} />;

  return (
    <Sheet title={habit.name} onClose={onClose} full>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <IconCircle name={habit.icon} color={habit.color} size={48} />
          <p className="text-caption text-muted">
            {scheduleLabel(habit)}
            {habit.note ? ` · ${habit.note}` : ''}
            <br />С {formatShortDate(habit.startDate)}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-[20px] bg-sunk px-3.5 py-3" aria-label={`${t.label}: ${t.value} ${t.sub}`}>
              <p className="text-[12px] text-muted">{t.label}</p>
              <p className="display-num text-[24px]">{t.value}</p>
              <p className="text-caption text-muted">{t.sub}</p>
            </div>
          ))}
        </div>
        <section className="space-y-2">
          <h3 className="text-caption font-semibold text-muted">Последние 12 недель · тап по дню ставит или снимает галочку</h3>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="space-y-1" role="group" aria-label="Календарь">
            {calendarWeeks(view, today).map((week, i, all) => {
              // Сверху вниз: текущая неделя, затем старше. Месяц недели — по четвергу (где больше её дней); подпись — над первой неделей и при смене месяца.
              const month = formatMonthTitle(week[3]!.date).split(' ')[0]!;
              const prev = i > 0 ? formatMonthTitle(all[i - 1]![3]!.date).split(' ')[0] : null;
              return (
                <div key={week[0]!.date}>
                  {month !== prev && <p className="px-1 pt-2 pb-1 text-caption font-semibold">{month}</p>}
                  <div className="grid grid-cols-7 gap-1">
                    {week.map((d) => (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => tapDay(d.date)}
                        disabled={d.state === 'before' || d.state === 'future'}
                        aria-label={`${formatShortDate(d.date)}: ${{ done: 'выполнено', missed: 'не выполнено', off: 'не по расписанию', before: 'до старта', future: 'впереди' }[d.state]}`}
                        className="flex min-h-11 items-center justify-center rounded-ctl"
                      >
                        <DayMark state={d.state} color={habit.color} size={36} label={String(parseLocalDate(d.date).day)} current={d.date === today} />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <Button variant="secondary" className="w-full" onClick={() => setEditing(true)}>
          Изменить привычку
        </Button>
      </div>
    </Sheet>
  );
}
