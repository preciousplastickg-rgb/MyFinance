import { useNav } from '../../app/nav';
import { partsLine } from '../../domain/goals';
import { plural } from '../../domain/money';
import { SectionHeader } from '../../ui/SectionHeader';
import { GoalRing } from '../goals/GoalRing';
import { useGoalViews } from '../goals/useGoalViews';

/** «Цели» на «Сегодня»: до 3 карточек с кольцом 52 и процентом (HANDOFF, «Сегодня»). Без целей блока нет. */
export function GoalsStrip() {
  const views = useGoalViews();
  const { push, setTab } = useNav();
  if (!views.length) return null;
  return (
    <section>
      <SectionHeader title="Цели" right={`${views.length} ${plural(views.length, ['активная', 'активные', 'активных'])}`} onClick={() => setTab('goals')} />
      <ul className="space-y-2.5" aria-label="Цели">
        {views.slice(0, 3).map((v) => (
          <li key={v.goal.id}>
            <button type="button" onClick={() => push({ name: 'goal', id: v.goal.id })} className="card flex w-full items-center gap-3.5 py-3 pr-4 pl-3 text-left">
              <GoalRing size={52} r={22} stroke={6} color={v.goal.color} frac={v.progress.frac} icon={v.goal.icon} iconSize={18} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{v.goal.name}</span>
                <span className="block text-[12px] text-muted">{partsLine(v.progress)}</span>
              </span>
              <span className="display-num text-h2">{v.progress.percent}%</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
