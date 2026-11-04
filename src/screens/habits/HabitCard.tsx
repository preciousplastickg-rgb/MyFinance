import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { useToday } from '../../app/nav';
import { toggleHabitDay } from '../../data/habits';
import { formatShortDate } from '../../domain/date';
import { habitSummary, weekOf, type DayState, type HabitView } from '../../domain/habits';
import { IconCircle } from '../../ui/icons';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/**
 * Отметка дня — квадрат: выполнено — заливка цветом привычки и белая галочка;
 * по расписанию, но не отмечено — рамка (или число месяца, если передан label);
 * не по расписанию, до старта и впереди — бледно. current — сегодня (или выбранный день): рамка цветом акцента
 * внутри квадрата, чтобы размер не отличался от соседних.
 */
export function DayMark({ state, color, size, label, current }: { state: DayState; color: string; size: number; label?: string; current?: boolean }) {
  const box = { width: size, height: size };
  if (state === 'done')
    return (
      <span className="inline-flex items-center justify-center rounded-ctl" style={{ ...box, background: color, color: 'white' }} aria-hidden>
        <Check size={Math.round(size * 0.65)} strokeWidth={3} />
      </span>
    );
  const faint = state !== 'missed' && !current;
  const frame = current ? 'inset 0 0 0 2px var(--accent)' : label ? undefined : `inset 0 0 0 ${faint ? 1 : 1.5}px var(--line)`;
  return (
    <span
      className={`tabular inline-flex items-center justify-center rounded-ctl text-[13px] ${current ? 'font-semibold text-ink' : 'text-muted'} ${faint ? 'opacity-40' : ''}`}
      style={{ ...box, boxShadow: frame }}
      aria-hidden
    >
      {label}
    </span>
  );
}

/** Карточка привычки: название, расписание и неделя пн–вс — тап по дню ставит или снимает галочку (SPEC 7a.1). */
export function HabitCard({ view, onOpen, date, handle }: { view: HabitView; onOpen: () => void; date?: string; handle?: ReactNode }) {
  const now = useToday(); // хук — всегда, даже если день задан
  const day = date ?? now;
  const { habit } = view;

  return (
    <div className="space-y-1 px-4 pt-2.5 pb-2">
      <div className="flex items-center">
        <button type="button" onClick={onOpen} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
          <IconCircle name={habit.icon} color={habit.color} size={36} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{habit.name}</span>
            <span className="tabular block truncate text-caption text-muted">{habitSummary(view, now)}</span>
          </span>
        </button>
        {handle && <div className="-mr-3">{handle}</div>}
      </div>
      <div className="grid grid-cols-7" role="group" aria-label={`Неделя: ${habit.name}`}>
        {weekOf(view, day).map((d, i) => {
          const locked = d.state === 'before' || d.state === 'future';
          const done = d.state === 'done';
          return (
            <button
              key={d.date}
              type="button"
              disabled={locked}
              aria-pressed={done}
              aria-label={`${habit.name}, ${WEEKDAYS[i]} ${formatShortDate(d.date)}${view.scheduled(d.date) || locked ? '' : ', не по расписанию'}`}
              onClick={() => void toggleHabitDay(habit, d.date)}
              className="flex min-h-11 flex-col items-center gap-0.5 py-0.5"
            >
              <span className={`text-[11px] ${d.date === day ? 'font-bold text-ink' : 'text-muted'}`}>{WEEKDAYS[i]}</span>
              <DayMark state={d.state} color={habit.color} size={28} current={d.date === day} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
