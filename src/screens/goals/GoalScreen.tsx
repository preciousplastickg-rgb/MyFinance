import { Minus, Plus } from '../../ui/glyphs';
import { useEffect, useState } from 'react';
import { useNav, useToday } from '../../app/nav';
import { applyTaskChange } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { colorCss } from '../../domain/catalog';
import { formatShortDate } from '../../domain/date';
import { dueLabel, leftLabel, perMonth } from '../../domain/goals';
import { formatAmount } from '../../domain/money';
import { everydayAccounts } from '../../domain/savings';
import { createTask } from '../../domain/tasks';
import { SubScreen } from '../../ui/SubScreen';
import { HabitCard } from '../habits/HabitCard';
import { HabitDetail } from '../habits/HabitDetail';
import { TaskGroup } from '../tasks/TaskList';
import { GoalRing } from './GoalRing';
import { LinkSheet } from './LinkSheet';
import { useGoalViews } from './useGoalViews';

/** Экран цели: кольцо, части, копилка с «Пополнить»/«Снять», привычки и дела, «Связать» (HANDOFF, «Цели»). */
export function GoalScreen({ id }: { id: string }) {
  const views = useGoalViews();
  const { accounts } = useData();
  const { push, pop, openEntry } = useNav();
  const today = useToday();
  const [link, setLink] = useState(false);
  const [openHabit, setOpenHabit] = useState<string | null>(null);
  const [newTask, setNewTask] = useState('');
  const v = views.find((x) => x.goal.id === id);
  // Цели больше нет (удалили или заменили данные бэкапом): уходим со экрана эффектом, а не из рендера —
  // менять состояние навигации во время рендера React запрещает.
  useEffect(() => {
    if (!v) pop();
  }, [v, pop]);
  if (!v) return null;
  const { goal, jar, progress } = v;
  const color = colorCss(goal.color);
  const everyday = everydayAccounts(accounts);
  const partner = jar ? (everyday.find((a) => a.currency === jar.currency) ?? everyday[0]) : undefined;
  const left = jar?.goal ? Math.max(0, jar.goal - v.jarBalance) : 0;
  const habitView = v.habits.find((h) => h.habit.id === openHabit);

  const addTask = () => {
    if (!newTask.trim()) return;
    void applyTaskChange(createTask({ title: newTask, goalId: goal.id }, Date.now()));
    setNewTask('');
  };

  return (
    <SubScreen
      title={goal.name}
      back="Цели"
      action={
        <button type="button" onClick={() => push({ name: 'goalEditor', id: goal.id })} className="min-h-11 px-3 font-medium text-accent">
          Изменить
        </button>
      }
      hero={
        <div className="flex items-center gap-4 px-5 pt-2 pb-[18px]">
          <GoalRing size={84} r={36} stroke={9} color={goal.color} frac={progress.frac} icon={goal.icon} iconSize={28} />
          <div className="min-w-0">
            <h1 className="text-[26px] leading-[1.15] font-semibold">{goal.name}</h1>
            <p className="mt-1 text-[14px] text-muted">
              {dueLabel(goal.dueDate)}
              {goal.dueDate ? ` · ${leftLabel(today, goal.dueDate)}` : ''}
            </p>
            <p className="display-num mt-1.5 text-[20px]">{progress.percent}%</p>
          </div>
        </div>
      }
    >

      {progress.parts.length ? (
        <section className="card p-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${progress.parts.length}, 1fr)` }}>
            {progress.parts.map((p) => (
              <div key={p.key}>
                <div className="h-1.5 overflow-hidden rounded-[3px] bg-sunk">
                  <div className="h-full rounded-[3px] transition-[width] duration-300" style={{ width: `${Math.max(2, p.frac * 100)}%`, background: color }} />
                </div>
                <p className="mt-1.5 text-[12px] text-muted">{p.label}</p>
                <p className="tabular font-semibold">{p.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-muted">Общий прогресс — среднее по частям</p>
        </section>
      ) : (
        <p className="rounded-card border-[1.5px] border-dashed border-line px-4 py-5 text-center text-[14px] text-muted">
          Пока пусто. Свяжите привычки и дела — прогресс начнёт считаться.
        </p>
      )}

      {jar && (
        <section>
          <h2 className="flex min-h-11 items-center px-1 text-h2 font-semibold">Копилка</h2>
          <div className="card p-4">
            <p className="tabular flex items-baseline gap-1.5">
              <span className="display-num text-[26px]">{formatAmount(v.jarBalance)}</span>
              {jar.goal && <span className="text-muted">из {formatAmount(jar.goal)} сом</span>}
            </p>
            {jar.goal && (
              <>
                <div className="mt-2.5 h-2.5 overflow-hidden rounded-[5px] bg-sunk" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round((v.jarBalance * 100) / jar.goal))} aria-label="Накоплено от цели">
                  <div className="jar-fill h-full rounded-[5px]" style={{ width: `${Math.min(100, (v.jarBalance * 100) / jar.goal)}%`, background: color }} />
                </div>
                <p className="tabular mt-2 text-caption text-muted">
                  {left === 0
                    ? 'Собрано полностью'
                    : `${Math.round((v.jarBalance * 100) / jar.goal)}% · осталось ${formatAmount(left)} · по ${formatAmount(perMonth(left, today, goal.dueDate))} в месяц до ${goal.dueDate ? formatShortDate(goal.dueDate) : 'конца года'}`}
                </p>
              </>
            )}
            <div className="mt-3.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => openEntry({ type: 'transfer', accountId: partner?.id, toAccountId: jar.id })}
                className="flex min-h-12 items-center justify-center gap-1.5 rounded-ctl bg-primary font-semibold text-on-primary"
              >
                <Plus size={17} aria-hidden />
                Пополнить
              </button>
              <button
                type="button"
                onClick={() => openEntry({ type: 'transfer', accountId: jar.id, toAccountId: partner?.id })}
                className="flex min-h-12 items-center justify-center gap-1.5 rounded-ctl font-semibold ring-[1.5px] ring-line ring-inset"
              >
                <Minus size={17} aria-hidden />
                Снять
              </button>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="flex min-h-11 items-center px-1">
          <h2 className="flex-1 text-h2 font-semibold">Привычки</h2>
          <button type="button" onClick={() => setLink(true)} className="min-h-11 px-1 text-[14px] font-semibold text-accent">
            Связать
          </button>
        </div>
        <div className="space-y-2.5">
          {v.habits.map((h) => (
            <HabitCard key={h.habit.id} view={h} onOpen={() => setOpenHabit(h.habit.id)} showRate />
          ))}
          {v.habits.length === 0 && <p className="card px-4 py-3.5 text-[14px] text-muted">Нет связанных привычек</p>}
        </div>
      </section>

      <section>
        <div className="flex min-h-11 items-center px-1">
          <h2 className="flex-1 text-h2 font-semibold">Дела</h2>
          <button type="button" onClick={() => setLink(true)} className="min-h-11 px-1 text-[14px] font-semibold text-accent">
            Связать
          </button>
        </div>
        <div className="card py-1">
          <TaskGroup bare tasks={[...v.tasks].sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'))} swipe={false} />
          <form
            className="flex min-h-[52px] items-center gap-2.5 border-t border-line px-4"
            onSubmit={(e) => {
              e.preventDefault();
              addTask();
            }}
          >
            <Plus size={18} className="shrink-0 text-accent" aria-hidden />
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Новое дело для цели"
              aria-label="Новое дело для цели"
              enterKeyHint="done"
              className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted/50"
            />
          </form>
        </div>
      </section>

      {link && <LinkSheet goal={goal} onClose={() => setLink(false)} />}
      {habitView && <HabitDetail view={habitView} onClose={() => setOpenHabit(null)} />}
    </SubScreen>
  );
}
