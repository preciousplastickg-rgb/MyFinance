import { Check, MoreHorizontal, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { useToday } from '../../app/nav';
import { addHabitCount, toggleHabitDay } from '../../data/habits';
import { habitSummary, lastDays, type DayState, type HabitView } from '../../domain/habits';
import { IconCircle } from '../../ui/icons';
import { CountSheet, RelapseSheet } from './HabitSheets';

export function DayDot({ state, color, size = 8 }: { state: DayState; color: string; size?: number }) {
  const style =
    state === 'done'
      ? { background: color }
      : state === 'partial'
        ? { background: `color-mix(in srgb, ${color} 40%, transparent)` }
        : state === 'relapse'
          ? { background: 'var(--warn)' }
          : state === 'missed'
            ? { background: 'var(--line)' }
            : { boxShadow: 'inset 0 0 0 1px var(--line)' };
  return <span className="inline-block rounded-full" style={{ width: size, height: size, ...style }} aria-hidden />;
}

// Одно правило для всех видов: не сделано — серое кольцо, сделано — заливка цветом привычки.
const NOT_DONE = { boxShadow: 'inset 0 0 0 2px color-mix(in srgb, var(--muted) 55%, transparent)', color: 'var(--muted)' };

/** Карточка привычки: прогресс, 7 точек и отметка за сегодня одним тапом (SPEC 7a.1). */
export function HabitCard({ view, onOpen }: { view: HabitView; onOpen: () => void }) {
  const today = useToday();
  const { habit } = view;
  const [sheet, setSheet] = useState<'count' | 'relapse' | null>(null);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const long = useRef(false);
  const doneToday = view.done(today);

  return (
    <div className="flex items-center gap-2 py-2.5 pr-2 pl-4">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <IconCircle name={habit.icon} color={habit.color} size={40} />
        <span className="min-w-0">
          <span className="block truncate font-medium">{habit.name}</span>
          <span className="tabular line-clamp-2 block text-caption text-muted">{habitSummary(view, today)}</span>
          <span className="mt-1 flex items-center gap-1" aria-hidden>
            {lastDays(view, today).map((d, i, all) => (
              <DayDot key={d.date} state={d.state} color={habit.color} size={i === all.length - 1 ? 10 : 8} />
            ))}
          </span>
        </span>
      </button>

      {(habit.kind === 'daily' || habit.kind === 'weekly') && (
        <button
          type="button"
          aria-pressed={doneToday}
          aria-label={`${doneToday ? 'Снять отметку' : 'Отметить'}: ${habit.name}`}
          onClick={() => void toggleHabitDay(habit.id, today)}
          className="flex size-11 shrink-0 items-center justify-center"
        >
          <span
            className="flex size-9 items-center justify-center rounded-full transition-colors duration-150"
            style={doneToday ? { background: habit.color, color: 'white' } : NOT_DONE}
          >
            <Check size={20} strokeWidth={doneToday ? 3 : 2} aria-hidden />
          </span>
        </button>
      )}

      {habit.kind === 'count' && (
        <button
          type="button"
          aria-label={`Плюс один: ${habit.name}`}
          onClick={() => {
            if (long.current) return void (long.current = false);
            void addHabitCount(habit.id, today, 1);
          }}
          onPointerDown={() => {
            long.current = false;
            press.current = setTimeout(() => {
              long.current = true;
              setSheet('count');
            }, 500);
          }}
          onPointerUp={() => press.current && clearTimeout(press.current)}
          onPointerLeave={() => press.current && clearTimeout(press.current)}
          onContextMenu={(e) => {
            e.preventDefault();
            setSheet('count');
          }}
          className="flex min-h-11 shrink-0 items-center gap-0.5 rounded-ctl px-3 font-semibold select-none"
          style={doneToday ? { background: habit.color, color: 'white' } : NOT_DONE}
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden />1
        </button>
      )}

      {habit.kind === 'abstain' && (
        <button
          type="button"
          aria-label={`Ещё: ${habit.name}`}
          onClick={() => setSheet('relapse')}
          className="flex size-11 shrink-0 items-center justify-center text-muted"
        >
          <MoreHorizontal size={20} aria-hidden />
        </button>
      )}

      {sheet === 'count' && <CountSheet view={view} date={today} onClose={() => setSheet(null)} />}
      {sheet === 'relapse' && <RelapseSheet view={view} date={today} onClose={() => setSheet(null)} />}
    </div>
  );
}
