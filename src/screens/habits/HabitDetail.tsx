import { useState } from 'react';
import { useToday } from '../../app/nav';
import { toggleHabitDay } from '../../data/habits';
import { formatShortDate } from '../../domain/date';
import { abstainDays, bestStreak, calendarWeeks, currentStreak, rate30, type HabitView } from '../../domain/habits';
import { plural } from '../../domain/money';
import type { LocalDate } from '../../domain/types';
import { Button } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { DayDot } from './HabitCard';
import { HabitEditor } from './HabitEditor';
import { CountSheet, RelapseSheet } from './HabitSheets';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Серии, % за 30 дней, календарь 12 недель с правкой прошлых дней (SPEC 7a.1). */
export function HabitDetail({ view, onClose }: { view: HabitView; onClose: () => void }) {
  const today = useToday();
  const { habit } = view;
  const [editing, setEditing] = useState(false);
  const [day, setDay] = useState<LocalDate | null>(null);
  const unit = habit.kind === 'weekly' ? (['неделя', 'недели', 'недель'] as const) : (['день', 'дня', 'дней'] as const);
  const current = habit.kind === 'abstain' ? abstainDays(view, today) : currentStreak(view, today);
  const best = Math.max(bestStreak(view, today), current);
  const tiles = [
    { label: habit.kind === 'abstain' ? 'Дней без' : 'Серия', value: `${current}`, sub: plural(current, unit) },
    { label: 'Лучшая', value: `${best}`, sub: plural(best, unit) },
    { label: '30 дней', value: `${rate30(view, today)}%`, sub: 'выполнено' },
  ];

  const tapDay = (date: LocalDate) => {
    if (date > today || date < habit.startDate) return;
    if (habit.kind === 'count' || habit.kind === 'abstain') setDay(date);
    else void toggleHabitDay(habit.id, date);
  };

  if (editing) return <HabitEditor habit={habit} onClose={onClose} />;

  return (
    <Sheet title={habit.name} onClose={onClose} full>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <IconCircle name={habit.icon} color={habit.color} size={48} />
          <p className="text-caption text-muted">С {formatShortDate(habit.startDate)}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-card bg-bg p-3" aria-label={`${t.label}: ${t.value} ${t.sub}`}>
              <p className="text-caption text-muted">{t.label}</p>
              <p className="tabular text-h1 font-bold">{t.value}</p>
              <p className="text-caption text-muted">{t.sub}</p>
            </div>
          ))}
        </div>
        <section className="space-y-2">
          <h3 className="text-caption font-semibold text-muted">12 недель · тап по дню — изменить отметку</h3>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Календарь">
            {calendarWeeks(view, today).flat().map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => tapDay(d.date)}
                disabled={d.state === 'before' || d.state === 'future'}
                aria-label={`${formatShortDate(d.date)}: ${{ done: 'выполнено', partial: 'частично', missed: 'не выполнено', relapse: 'срыв', before: 'до старта', future: 'впереди' }[d.state]}`}
                className={`flex aspect-square items-center justify-center rounded-ctl ${d.date === today ? 'ring-2 ring-accent' : ''}`}
              >
                <DayDot state={d.state} color={habit.color} size={18} />
              </button>
            ))}
          </div>
        </section>
        <Button variant="secondary" className="w-full" onClick={() => setEditing(true)}>
          Изменить привычку
        </Button>
      </div>
      {day && habit.kind === 'count' && <CountSheet view={view} date={day} onClose={() => setDay(null)} />}
      {day && habit.kind === 'abstain' && <RelapseSheet view={view} date={day} onClose={() => setDay(null)} />}
    </Sheet>
  );
}
