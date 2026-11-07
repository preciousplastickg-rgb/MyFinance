import { Check } from '../../ui/glyphs';
import { useState } from 'react';
import { useNav, useToday } from '../../app/nav';
import { toggleHabitDay } from '../../data/habits';
import { colorCss } from '../../domain/catalog';
import { currentStreak, isEveryDay, weekOf, type HabitView } from '../../domain/habits';
import { IconCircle } from '../../ui/icons';
import { SectionHeader } from '../../ui/SectionHeader';
import { HabitDetail } from '../habits/HabitDetail';
import { useHabitViews } from '../habits/HabitsView';

/** Точка дня недели 12 px: выполнено — цвет привычки; пропущено — подложка и рамка; сегодня — рамка акцента; впереди и вне расписания — бледно. */
function WeekDot({ color, state, current }: { color: string; state: string; current: boolean }) {
  const done = state === 'done';
  const missed = state === 'missed';
  const faint = state === 'future' || state === 'before' || (state === 'off' && !current);
  const ring = done ? undefined : current ? 'inset 0 0 0 1.5px var(--accent)' : missed ? `inset 0 0 0 1px color-mix(in srgb, ${color} 55%, transparent)` : 'inset 0 0 0 1px var(--line)';
  return (
    <span
      className={`size-3 rounded-full ${faint ? 'opacity-40' : ''}`}
      style={{ background: done ? color : missed ? `color-mix(in srgb, ${color} 8%, transparent)` : undefined, boxShadow: ring }}
    />
  );
}

/** «Привычки» на «Сегодня», вариант hvCompact: строка 60 px, неделя точками, серия, круг «отметить сегодня». */
export function HabitsBlock() {
  const views = useHabitViews();
  const today = useToday();
  const { showTasks } = useNav();
  const [open, setOpen] = useState<string | null>(null);
  if (!views.length) return null;
  // Счёт — по привычкам, которые ждём сегодня; галочка вне расписания тоже засчитывается.
  const due = views.filter((v) => v.scheduled(today) || v.done(today));
  const done = due.filter((v) => v.done(today)).length;
  const current: HabitView | undefined = views.find((v) => v.habit.id === open);
  return (
    <section>
      <SectionHeader title="Привычки" right={`${done} из ${due.length} сегодня`} onClick={() => showTasks('habits')} />
      <ul className="card divide-y divide-line overflow-hidden py-1" aria-label="Привычки">
        {views.map((v) => {
          const streak = currentStreak(v, today);
          const doneToday = v.done(today);
          const color = colorCss(v.habit.color);
          return (
            <li key={v.habit.id} className="flex min-h-[60px] items-center gap-2.5 py-1.5 pr-1.5 pl-4">
              <button type="button" onClick={() => setOpen(v.habit.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                <IconCircle name={v.habit.icon} color={v.habit.color} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{v.habit.name}</span>
                  <span className="mt-1 flex gap-[3px]" aria-hidden>
                    {weekOf(v, today).map((d) => (
                      <WeekDot key={d.date} color={color} state={d.state} current={d.date === today} />
                    ))}
                  </span>
                </span>
              </button>
              <span className="tabular shrink-0 text-[12px] whitespace-nowrap text-muted">
                {streak} {isEveryDay(v.habit) ? 'дн.' : 'раз'}
              </span>
              <button
                type="button"
                aria-pressed={doneToday}
                aria-label={`${v.habit.name}: отметить сегодня`}
                onClick={() => void toggleHabitDay(v.habit, today)}
                className="flex size-11 shrink-0 items-center justify-center"
              >
                <span
                  className="flex size-[30px] items-center justify-center rounded-full text-white transition-colors duration-150"
                  style={{ background: doneToday ? color : undefined, boxShadow: doneToday ? undefined : 'inset 0 0 0 2px var(--accent)' }}
                >
                  {doneToday && <Check size={17} strokeWidth={2.5} aria-hidden />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {current && <HabitDetail view={current} onClose={() => setOpen(null)} />}
    </section>
  );
}
