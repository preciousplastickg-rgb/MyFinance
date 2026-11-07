import { Check } from '../../ui/glyphs';
import { useMemo, type ReactNode } from 'react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { shortName } from '../../domain/goals';
import { formatAmount } from '../../domain/money';
import { GoalChip } from '../goals/GoalRing';
import { toggleHabitDay } from '../../data/habits';
import { formatShortDate } from '../../domain/date';
import { habitSummary, rate30, weekOf, type DayState, type HabitView } from '../../domain/habits';
import { IconCircle } from '../../ui/icons';
import { colorCss } from '../../domain/catalog';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/**
 * Отметка дня — круг (HANDOFF, habitView): выполнено — заливка цветом привычки и белая галочка;
 * пропущено (по расписанию, не сделано, в прошлом) — подложка 8% и рамка 1.5 цветом привычки;
 * сегодня — рамка 2 цветом акцента; впереди и вне расписания — бледно (opacity .4). label — число месяца в календаре.
 */
export function DayMark({ state, color, size, label, current }: { state: DayState; color: string; size: number; label?: string; current?: boolean }) {
  const box = { width: size, height: size };
  if (state === 'done')
    return (
      <span className="inline-flex items-center justify-center rounded-full" style={{ ...box, background: colorCss(color), color: 'white' }} aria-hidden>
        <Check size={Math.round(size * 0.57)} strokeWidth={2.5} />
      </span>
    );
  const missed = state === 'missed' && !current;
  const faint = state === 'future' || state === 'before' || (state === 'off' && !current);
  const frame = current
    ? 'inset 0 0 0 2px var(--accent)'
    : missed
      ? `inset 0 0 0 1.5px color-mix(in srgb, ${colorCss(color)} 55%, transparent)`
      : 'inset 0 0 0 1px var(--line)';
  return (
    <span
      className={`tabular inline-flex items-center justify-center rounded-full text-[13px] ${current ? 'font-semibold text-ink' : 'text-muted'} ${faint ? 'opacity-40' : ''}`}
      style={{ ...box, boxShadow: frame, background: missed ? `color-mix(in srgb, ${colorCss(color)} 8%, transparent)` : undefined }}
      aria-hidden
    >
      {label}
    </span>
  );
}

/** Карточка привычки: название, расписание и неделя пн–вс — тап по дню ставит или снимает галочку (SPEC 7a.1). */
export function HabitCard({ view, onOpen, date, handle, showRate = false }: { view: HabitView; onOpen: () => void; date?: string; handle?: ReactNode; showRate?: boolean }) {
  const now = useToday(); // хук — всегда, даже если день задан
  const day = date ?? now;
  const { habit } = view;
  const { goals, transactions, categoryById } = useData();
  const goal = habit.goalId ? goals.find((g) => g.id === habit.goalId) : undefined;
  // «Без кафе»: трата в отслеживаемой категории сегодня — предупреждение вместо подписи (HANDOFF, habitView).
  const watched = habit.watchCategoryId ? categoryById.get(habit.watchCategoryId) : undefined;
  const spentWatched = useMemo(
    () => (watched ? transactions.filter((t) => t.type === 'expense' && t.date === day && t.categoryId === watched.id).reduce((s, t) => s + t.amount, 0) : 0),
    [watched, transactions, day],
  );

  return (
    <div className="card w-full px-4 pt-3 pb-2.5">
      <div className="flex items-center">
        <button type="button" onClick={onOpen} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
          <IconCircle name={habit.icon} color={habit.color} size={36} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{habit.name}</span>
            <span className={`tabular block truncate text-[12px] ${spentWatched > 0 ? 'text-warn' : 'text-muted'}`}>
              {spentWatched > 0 ? `Сегодня уже ${formatAmount(spentWatched)} сом в «${watched!.name}»` : habitSummary(view, now)}
            </span>
          </span>
        </button>
        {showRate && <span className="tabular shrink-0 pl-2 text-caption font-semibold">{rate30(view, now)}%</span>}
        {goal && !showRate && <GoalChip color={goal.color} name={shortName(goal.name)} />}
        {handle && <div className="-mr-3">{handle}</div>}
      </div>
      <div className="mt-1.5 grid grid-cols-7" role="group" aria-label={`Неделя: ${habit.name}`}>
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
              className="flex min-h-11 flex-col items-center gap-[3px] py-0.5"
            >
              <span className={`text-[11px] ${d.date === day ? 'font-bold text-ink' : 'text-muted'}`}>{WEEKDAYS[i]}</span>
              <DayMark state={d.state} color={habit.color} size={30} current={d.date === day} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
