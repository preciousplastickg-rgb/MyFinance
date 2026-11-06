import { Check, PiggyBank, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNav, useToday } from '../../app/nav';
import { applyTaskChange, nextSortOrder } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { deleteGoal, saveGoal, setHabitGoal, setTaskGoal } from '../../data/goals';
import { colorCss, tint } from '../../domain/catalog';
import { BASE_CURRENCY } from '../../domain/currency';
import { formatRelativeDate, formatShortDate } from '../../domain/date';
import { DUE_PRESETS, dueFromPreset, GOAL_COLORS, GOAL_ICONS, goalById, perMonth, type DuePreset } from '../../domain/goals';
import { formatAmount, parseMoneyText } from '../../domain/money';
import { monthsUntil } from '../../domain/savings';
import { createTask } from '../../domain/tasks';
import type { Account, Goal } from '../../domain/types';
import { Button } from '../../ui/controls';
import { ConfirmSheet } from '../../ui/ConfirmSheet';
import { Icon, IconCircle } from '../../ui/icons';
import { useToast } from '../../ui/Toast';

function CheckCircle({ on }: { on: boolean }) {
  return (
    <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border-[1.75px] text-on-primary ${on ? 'border-primary bg-primary' : 'border-muted'}`} aria-hidden>
      {on && <Check size={15} strokeWidth={2.5} />}
    </span>
  );
}

/**
 * Создание и правка цели (HANDOFF, «Создание цели»): название, значок, цвет, срок, копилка с суммой и расчётом
 * «по X сом в месяц», привычки и дела (с пометкой «сейчас ведёт к …»), новое дело. «Создать» активна при непустом названии.
 */
export function GoalEditor({ id }: { id?: string }) {
  const { goals, habits, tasks, accounts, balances } = useData();
  const { pop } = useNav();
  const today = useToday();
  const toast = useToast();
  const existing = goals.find((g) => g.id === id);
  const jar = existing?.jarAccountId ? accounts.find((a) => a.id === existing.jarAccountId) : undefined;
  const byId = goalById(goals);

  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? GOAL_ICONS[0]);
  const [color, setColor] = useState(existing?.color ?? GOAL_COLORS[0]);
  const [due, setDue] = useState<DuePreset | 'keep'>(existing ? 'keep' : '3m');
  const [wantJar, setWantJar] = useState(!!jar);
  const [target, setTarget] = useState(jar?.goal ? formatAmount(jar.goal) : '');
  const [habitIds, setHabitIds] = useState<string[]>(habits.filter((h) => h.goalId === id).map((h) => h.id));
  const [taskIds, setTaskIds] = useState<string[]>(tasks.filter((t) => t.goalId === id && t.status === 'open').map((t) => t.id));
  const [newTasks, setNewTasks] = useState<string[]>([]);
  const [draftTask, setDraftTask] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const dueDate = due === 'keep' ? existing?.dueDate : dueFromPreset(today, due);
  const targetMinor = target.trim() === '' ? 0 : (parseMoneyText(target) ?? 0);
  const have = jar ? (balances.get(jar.id) ?? 0) : 0;
  const months = dueDate ? monthsUntil(today, dueDate) : 12;
  const planLine =
    wantJar && targetMinor > have ? `по ${formatAmount(perMonth(targetMinor - have, today, dueDate))} сом в месяц, чтобы успеть ${dueDate ? `до ${formatShortDate(dueDate)}` : `за ${months} мес.`}` : '';
  const valid = name.trim() !== '';
  const toggle = (list: string[], set: (v: string[]) => void, x: string) => set(list.includes(x) ? list.filter((i) => i !== x) : [...list, x]);
  const fg = colorCss(color);

  const save = async () => {
    if (!valid) return;
    const now = Date.now();
    const goal: Goal = { ...existing, id: existing?.id ?? crypto.randomUUID(), name: name.trim(), icon, color, createdAt: existing?.createdAt ?? now };
    if (dueDate) goal.dueDate = dueDate;
    else delete goal.dueDate;
    let newJar: Account | undefined;
    if (wantJar) {
      const base: Account = jar ?? {
        id: crypto.randomUUID(),
        name: goal.name,
        type: 'savings',
        currency: BASE_CURRENCY,
        icon,
        color,
        includeInDaily: false,
        openingBalance: 0,
        openingDate: today,
        sortOrder: await nextSortOrder('accounts'),
        archived: false,
        purpose: 'fund',
      };
      newJar = { ...base, name: jar ? jar.name : goal.name, icon, color };
      if (targetMinor > 0) newJar.goal = targetMinor;
      else delete newJar.goal;
      if (dueDate) newJar.goalDate = dueDate;
      else delete newJar.goalDate;
      goal.jarAccountId = newJar.id;
    } else delete goal.jarAccountId;
    // Снятые галочки — отвязать; новые — привязать.
    const unlinkHabits = habits.filter((h) => h.goalId === goal.id && !habitIds.includes(h.id)).map((h) => h.id);
    const unlinkTasks = tasks.filter((t) => t.goalId === goal.id && !taskIds.includes(t.id)).map((t) => t.id);
    await saveGoal(goal, newJar, { habitIds, taskIds });
    await Promise.all([...unlinkHabits.map((h) => setHabitGoal(h, undefined)), ...unlinkTasks.map((t) => setTaskGoal(t, undefined))]);
    for (const title of newTasks) await applyTaskChange(createTask({ title, goalId: goal.id }, Date.now()));
    pop();
    if (!existing) toast({ message: `Цель «${goal.name}» создана` });
  };

  const remove = async () => {
    if (!existing) return;
    await deleteGoal(existing.id);
    pop();
    pop();
    toast({ message: `Цель «${existing.name}» удалена` });
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="goal-editor-title" className="pt-safe fixed inset-0 z-40 mx-auto flex max-w-lg flex-col bg-bg">
      <div className="grid min-h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center px-3">
        <button type="button" onClick={pop} className="min-h-11 justify-self-start px-1 font-medium text-accent">
          Отмена
        </button>
        <h2 id="goal-editor-title" className="text-h2 font-semibold">
          {existing ? 'Цель' : 'Новая цель'}
        </h2>
        <button type="button" disabled={!valid} onClick={() => void save()} className={`min-h-11 justify-self-end px-1 font-bold ${valid ? 'text-accent' : 'text-muted'}`}>
          Готово
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-10">
        <div className="flex flex-col items-center gap-3 px-4 pt-4 pb-2">
          <span className="flex size-20 items-center justify-center rounded-full transition-colors duration-200" style={{ background: tint(color), color: fg }} aria-hidden>
            <Icon name={icon} size={34} />
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название цели"
            aria-label="Название цели"
            className="h-12 w-full bg-transparent text-center text-[22px] font-semibold outline-none placeholder:text-muted/50"
          />
        </div>
        <div className="space-y-4 px-4">
          <div className="card px-4 py-3.5">
            <div role="radiogroup" aria-label="Значок" className="grid grid-cols-6 gap-1.5">
              {GOAL_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  role="radio"
                  aria-checked={icon === ic}
                  aria-label={ic}
                  onClick={() => setIcon(ic)}
                  className="flex h-11 items-center justify-center rounded-full"
                  style={icon === ic ? { background: tint(color), color: fg } : { color: 'var(--muted)' }}
                >
                  <Icon name={ic} size={19} />
                </button>
              ))}
            </div>
            <div role="radiogroup" aria-label="Цвет" className="mt-2.5 grid grid-cols-6 gap-1.5 border-t border-line pt-3">
              {GOAL_COLORS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)} className="flex h-11 items-center justify-center">
                  <span className="size-[30px] rounded-full" style={{ background: colorCss(c), boxShadow: color === c ? `0 0 0 3px var(--surface), 0 0 0 5px ${colorCss(c)}` : undefined }} />
                </button>
              ))}
            </div>
          </div>

          <section>
            <p className="px-1 pb-2 text-caption font-semibold text-muted">Срок</p>
            <div role="radiogroup" aria-label="Срок" className="flex flex-wrap gap-1.5">
              {existing?.dueDate && (
                <button type="button" role="radio" aria-checked={due === 'keep'} onClick={() => setDue('keep')} className={`min-h-10 rounded-full px-4 text-[14px] font-semibold ring-1 ring-inset ${due === 'keep' ? 'bg-ink text-bg ring-ink' : 'bg-surface text-ink ring-line'}`}>
                  до {formatShortDate(existing.dueDate)}
                </button>
              )}
              {DUE_PRESETS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={due === d.id}
                  onClick={() => setDue(d.id)}
                  className={`min-h-10 rounded-full px-4 text-[14px] font-semibold ring-1 ring-inset ${due === d.id ? 'bg-ink text-bg ring-ink' : 'bg-surface text-ink ring-line'}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </section>

          <div className="card py-1">
            <button type="button" role="switch" aria-checked={wantJar} onClick={() => setWantJar(!wantJar)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left">
              <PiggyBank size={20} className="text-muted" aria-hidden />
              <span className="flex-1 font-medium">Копить деньги</span>
              <span className={`flex h-7 w-12 rounded-[14px] p-[3px] transition-colors duration-150 ${wantJar ? 'justify-end bg-primary' : 'justify-start bg-line'}`}>
                <span className="size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)]" />
              </span>
            </button>
            {wantJar && (
              <>
                <label className="flex min-h-[52px] items-center gap-2.5 border-t border-line px-4">
                  <span className="text-[14px] text-muted">Сколько нужно</span>
                  <input
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                    aria-label="Сколько нужно"
                    className="tabular h-11 min-w-0 flex-1 bg-transparent text-right text-h2 font-semibold outline-none"
                  />
                  <span className="text-muted">сом</span>
                </label>
                {planLine && <p className="px-4 pb-3 text-[12px] text-muted">{planLine}</p>}
              </>
            )}
          </div>

          <section>
            <p className="px-1 pb-2 text-caption font-semibold text-muted">Привычки, которые ведут к цели</p>
            <div className="card divide-y divide-line py-0.5">
              {habits
                .filter((h) => !h.archived)
                .map((h) => {
                  const other = h.goalId && h.goalId !== id ? byId.get(h.goalId)?.name : undefined;
                  return (
                    <button key={h.id} type="button" aria-pressed={habitIds.includes(h.id)} onClick={() => toggle(habitIds, setHabitIds, h.id)} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left">
                      <IconCircle name={h.icon} color={h.color} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{h.name}</span>
                        {other && <span className="block text-[12px] text-muted">сейчас ведёт к «{other}»</span>}
                      </span>
                      <CheckCircle on={habitIds.includes(h.id)} />
                    </button>
                  );
                })}
              {habits.filter((h) => !h.archived).length === 0 && <p className="px-4 py-3 text-[14px] text-muted">Привычек пока нет</p>}
            </div>
          </section>

          <section>
            <p className="px-1 pb-2 text-caption font-semibold text-muted">Дела</p>
            <div className="card divide-y divide-line py-0.5">
              {tasks
                .filter((t) => t.status === 'open')
                .map((t) => {
                  const other = t.goalId && t.goalId !== id ? byId.get(t.goalId)?.name : undefined;
                  return (
                    <button key={t.id} type="button" aria-pressed={taskIds.includes(t.id)} onClick={() => toggle(taskIds, setTaskIds, t.id)} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{t.title}</span>
                        <span className="block text-[12px] text-muted">
                          {t.date ? formatRelativeDate(t.date, today) : 'без даты'}
                          {other ? ` · сейчас ведёт к «${other}»` : ''}
                        </span>
                      </span>
                      <CheckCircle on={taskIds.includes(t.id)} />
                    </button>
                  );
                })}
              {newTasks.map((t, i) => (
                <div key={`new-${i}`} className="flex min-h-[52px] items-center gap-3 px-4">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{t}</span>
                    <span className="block text-[12px] text-muted">новое дело</span>
                  </span>
                  <CheckCircle on />
                </div>
              ))}
              <form
                className="flex min-h-[52px] items-center gap-2.5 px-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!draftTask.trim()) return;
                  setNewTasks([...newTasks, draftTask.trim()]);
                  setDraftTask('');
                }}
              >
                <Plus size={18} className="shrink-0 text-accent" aria-hidden />
                <input
                  value={draftTask}
                  onChange={(e) => setDraftTask(e.target.value)}
                  placeholder="Новое дело"
                  aria-label="Новое дело"
                  enterKeyHint="done"
                  className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted/50"
                />
              </form>
            </div>
          </section>

          <button
            type="button"
            disabled={!valid}
            onClick={() => void save()}
            className="min-h-14 w-full rounded-ctl bg-primary text-h2 font-semibold text-on-primary transition-colors duration-150 disabled:bg-sunk disabled:text-muted"
          >
            {existing ? 'Сохранить' : 'Создать цель'}
          </button>
          {existing && (
            <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>
              Удалить цель
            </Button>
          )}
        </div>
      </div>
      {confirmDelete && (
        <ConfirmSheet
          title="Удалить цель?"
          text="Привычки и дела останутся, копилка станет обычной копилкой."
          confirmLabel="Удалить"
          onConfirm={() => void remove()}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>,
    document.body,
  );
}
