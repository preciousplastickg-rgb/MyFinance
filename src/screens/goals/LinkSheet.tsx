import { Check } from 'lucide-react';
import { useData } from '../../data/DataProvider';
import { setHabitGoal, setTaskGoal } from '../../data/goals';
import { goalById } from '../../domain/goals';
import { formatRelativeDate } from '../../domain/date';
import type { Goal } from '../../domain/types';
import { useToday } from '../../app/nav';
import { Button } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';

function CheckCircle({ on }: { on: boolean }) {
  return (
    <span
      className={`flex size-6 shrink-0 items-center justify-center rounded-full border-[1.75px] text-on-primary ${on ? 'border-primary bg-primary' : 'border-muted'}`}
      aria-hidden
    >
      {on && <Check size={15} strokeWidth={2.5} />}
    </span>
  );
}

/** «Связать с «…»»: привычка или дело может вести только к одной цели (HANDOFF, «Цели»). */
export function LinkSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { habits, tasks, goals } = useData();
  const today = useToday();
  const byId = goalById(goals);
  const other = (goalId?: string) => (goalId && goalId !== goal.id ? byId.get(goalId)?.name : undefined);
  const activeHabits = habits.filter((h) => !h.archived);
  const openTasks = tasks.filter((t) => t.status === 'open');
  return (
    <Sheet title={`Связать с «${goal.name}»`} onClose={onClose} full>
      <div className="space-y-3.5">
        <p className="-mt-1 text-caption text-muted">Привычка или дело может вести только к одной цели</p>
        <div>
          <p className="px-1 pb-1.5 text-caption font-semibold text-muted">Привычки</p>
          <div role="group" aria-label="Привычки" className="divide-y divide-line rounded-[20px] bg-sunk py-0.5">
            {activeHabits.map((h) => {
              const on = h.goalId === goal.id;
              const o = other(h.goalId);
              return (
                <button
                  key={h.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => void setHabitGoal(h.id, on ? undefined : goal.id)}
                  className="flex min-h-[52px] w-full items-center gap-3 px-3.5 text-left"
                >
                  <IconCircle name={h.icon} color={h.color} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{h.name}</span>
                    {o && <span className="block text-[12px] text-muted">сейчас ведёт к «{o}»</span>}
                  </span>
                  <CheckCircle on={on} />
                </button>
              );
            })}
            {activeHabits.length === 0 && <p className="px-3.5 py-3 text-[14px] text-muted">Привычек пока нет</p>}
          </div>
        </div>
        <div>
          <p className="px-1 pb-1.5 text-caption font-semibold text-muted">Дела</p>
          <div role="group" aria-label="Дела" className="divide-y divide-line rounded-[20px] bg-sunk py-0.5">
            {openTasks.map((t) => {
              const on = t.goalId === goal.id;
              const o = other(t.goalId);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => void setTaskGoal(t.id, on ? undefined : goal.id)}
                  className="flex min-h-[52px] w-full items-center gap-3 px-3.5 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{t.title}</span>
                    <span className="block text-[12px] text-muted">
                      {t.date ? formatRelativeDate(t.date, today) : 'без даты'}
                      {o ? ` · сейчас ведёт к «${o}»` : ''}
                    </span>
                  </span>
                  <CheckCircle on={on} />
                </button>
              );
            })}
            {openTasks.length === 0 && <p className="px-3.5 py-3 text-[14px] text-muted">Открытых дел нет</p>}
          </div>
        </div>
        <Button className="w-full" onClick={onClose}>
          Готово
        </Button>
      </div>
    </Sheet>
  );
}
