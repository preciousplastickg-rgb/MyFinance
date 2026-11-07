import { ChevronDown } from 'lucide-react';
import { useNav } from '../../app/nav';
import { partsLine } from '../../domain/goals';
import { plural } from '../../domain/money';
import { SectionHeader } from '../../ui/SectionHeader';
import { useRememberedOpen } from '../../ui/useRememberedOpen';
import { GoalRing } from '../goals/GoalRing';
import { useGoalViews } from '../goals/useGoalViews';

/**
 * «Цели» на «Сегодня» (этап 25): компактные строки 52 px в одной карточке — кольцо 32, название, подпись, процент;
 * тап по заголовку сворачивает и разворачивает, как «Счета» (состояние запоминается). Без целей блока нет.
 */
export function GoalsStrip() {
  const views = useGoalViews();
  const { push } = useNav();
  const [open, setOpen] = useRememberedOpen('today-goals-open', true);
  if (!views.length) return null;
  const avg = Math.round(views.reduce((s, v) => s + v.progress.percent, 0) / views.length);
  return (
    <section>
      <SectionHeader
        title="Цели"
        onClick={() => setOpen(!open)}
        expanded={open}
        label={open ? 'Свернуть цели' : 'Показать цели'}
        right={`${views.length} ${plural(views.length, ['активная', 'активные', 'активных'])} · ${avg}%`}
        icon={<ChevronDown size={16} aria-hidden className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />}
      />
      {open && (
        <ul className="card divide-y divide-line overflow-hidden py-1" aria-label="Цели">
          {views.slice(0, 3).map((v) => (
            <li key={v.goal.id}>
              <button
                type="button"
                onClick={() => push({ name: 'goal', id: v.goal.id })}
                aria-label={`${v.goal.name}: ${v.progress.percent}%. Открыть цель`}
                className="flex min-h-13 w-full items-center gap-3 px-4 py-1.5 text-left active:bg-sunk"
              >
                <GoalRing size={32} r={13} stroke={4} color={v.goal.color} frac={v.progress.frac} icon={v.goal.icon} iconSize={13} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{v.goal.name}</span>
                  <span className="block truncate text-[12px] text-muted">{partsLine(v.progress)}</span>
                </span>
                <span className="display-num shrink-0 text-[15px]">{v.progress.percent}%</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
