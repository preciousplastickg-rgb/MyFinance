import type { ReactNode } from 'react';
import { useNav } from '../app/nav';
import { useAddAction } from '../app/useAddAction';
import { reorder } from '../data/actions';
import { SortableList } from '../ui/SortableList';
import { dueLabel, linksLine } from '../domain/goals';
import { colorCss } from '../domain/catalog';
import { ScreenHeader } from '../ui/ScreenHeader';
import { GoalRing } from './goals/GoalRing';
import { useGoalViews, type GoalView } from './goals/useGoalViews';

/** Карточка цели в списке: кольцо 60, название, «до … · связи», процент, полоски частей; справа — ручка порядка (этап 29). */
export function GoalCard({ v, handle }: { v: GoalView; handle?: ReactNode }) {
  const { push } = useNav();
  const { goal, progress } = v;
  return (
    <div className="card flex w-full">
    <button type="button" onClick={() => push({ name: 'goal', id: goal.id })} className={`block min-w-0 flex-1 p-4 text-left ${handle ? 'pr-1' : ''}`}>
      <span className="flex items-center gap-3.5">
        <GoalRing size={60} r={25} stroke={7} color={goal.color} frac={progress.frac} icon={goal.icon} iconSize={20} />
        <span className="min-w-0 flex-1">
          <span className="block text-h2 font-semibold">{goal.name}</span>
          <span className="block text-meta text-muted">
            {dueLabel(goal.dueDate)} · {linksLine(!!v.jar, v.habits.length, v.tasks.length)}
          </span>
        </span>
        <span className="display-num text-num-m">{progress.percent}%</span>
      </span>
      {progress.parts.length > 0 && (
        <span className="mt-3.5 grid gap-2.5" style={{ gridTemplateColumns: `repeat(${progress.parts.length}, 1fr)` }}>
          {progress.parts.map((p) => (
            <span key={p.key} className="block">
              <span className="mb-1.5 flex justify-between text-micro text-muted">
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
    {handle && <div className="flex items-start pt-3.5 pr-1">{handle}</div>}
    </div>
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
        {/* Порядок — перетаскиванием за ручку, как у привычек (этап 29); первые три видны на «Сегодня». */}
        {views.length > 1 ? (
          <SortableList
            items={views.map((v) => ({ id: v.goal.id, v }))}
            inlineHandle
            listClass="space-y-2.5"
            itemLabel={(i) => i.v.goal.name}
            onReorder={(ids) => void reorder('goals', ids)}
            renderItem={(i, handle) => <GoalCard v={i.v} handle={handle} />}
          />
        ) : (
          views.map((v) => <GoalCard key={v.goal.id} v={v} />)
        )}
        {views.length === 0 && (
          <p className="rounded-card border-[1.5px] border-dashed border-line px-4 py-5 text-center text-sub text-muted">
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
