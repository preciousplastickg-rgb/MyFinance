import { useNav } from '../app/nav';
import { useAddAction } from '../app/useAddAction';
import { dueLabel, linksLine } from '../domain/goals';
import { colorCss } from '../domain/catalog';
import { ScreenHeader } from '../ui/ScreenHeader';
import { GoalRing } from './goals/GoalRing';
import { useGoalViews, type GoalView } from './goals/useGoalViews';

/** Карточка цели в списке: кольцо 60, название, «до … · связи», процент, полоски частей. */
export function GoalCard({ v }: { v: GoalView }) {
  const { push } = useNav();
  const { goal, progress } = v;
  return (
    <button type="button" onClick={() => push({ name: 'goal', id: goal.id })} className="card block w-full p-4 text-left">
      <span className="flex items-center gap-3.5">
        <GoalRing size={60} r={25} stroke={7} color={goal.color} frac={progress.frac} icon={goal.icon} iconSize={20} />
        <span className="min-w-0 flex-1">
          <span className="block text-h2 font-semibold">{goal.name}</span>
          <span className="block text-[12px] text-muted">
            {dueLabel(goal.dueDate)} · {linksLine(!!v.jar, v.habits.length, v.tasks.length)}
          </span>
        </span>
        <span className="display-num text-[20px]">{progress.percent}%</span>
      </span>
      {progress.parts.length > 0 && (
        <span className="mt-3.5 grid gap-2.5" style={{ gridTemplateColumns: `repeat(${progress.parts.length}, 1fr)` }}>
          {progress.parts.map((p) => (
            <span key={p.key} className="block">
              <span className="mb-1.5 flex justify-between text-[11px] text-muted">
                <span>{p.label}</span>
                <span className="tabular text-ink">{p.value}</span>
              </span>
              <span className="block h-1.5 overflow-hidden rounded-[3px] bg-sunk">
                <span className="block h-full rounded-[3px]" style={{ width: `${Math.max(2, p.frac * 100)}%`, background: colorCss(goal.color) }} />
              </span>
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

/** Список целей с подписью; без целей — пунктирная подсказка. */
export function GoalsList() {
  const views = useGoalViews();
  const { push } = useNav();
  useAddAction('Новая цель', () => push({ name: 'goalEditor' }));
  return (
    <>
      <p className="-mt-1 px-1 text-caption text-pretty text-muted">Цель собирает копилку, привычки и дела в один прогресс.</p>
      <div className="space-y-2.5">
        {views.map((v) => (
          <GoalCard key={v.goal.id} v={v} />
        ))}
        {views.length === 0 && (
          <p className="rounded-card border-[1.5px] border-dashed border-line px-4 py-5 text-center text-[14px] text-muted">
            Пока целей нет. Нажмите «+» в меню: название, срок, копилка, привычки и дела.
          </p>
        )}
      </div>
    </>
  );
}

/** «Цели»: список; новая цель — «+» в меню (этап 28, прежде «+ Новая» в шапке). При «+» по центру эта вкладка — третий раздел «Дел» (этап 26). */
export function Goals() {
  return (
    <>
      <ScreenHeader title="Цели" />
      <div className="space-y-4 px-4">
        <GoalsList />
      </div>
    </>
  );
}
