import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNav, useToday } from '../../app/nav';
import { useToast } from '../../ui/Toast';
import { applyTaskChange } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { formatMonthKey, formatShortDate, monthOf, parseLocalDate } from '../../domain/date';
import { deleteTask, periodStats, rescheduleTask, shiftPeriod, stalledTasks, taskWarning, type PeriodKind } from '../../domain/tasks';
import { Bars, CountUp } from '../../ui/charts';
import { Segmented } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { PostponeSheet } from '../tasks/PostponeSheet';
import { TaskListSheet } from './TaskListSheet';
import type { Task } from '../../domain/types';

function periodTitle(kind: PeriodKind, from: string, to: string): string {
  if (kind === 'month') return formatMonthKey(monthOf(from));
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  return a.month === b.month ? `${a.day}–${formatShortDate(to)}` : `${formatShortDate(from)} – ${formatShortDate(to)}`;
}

/** Отчёты → Дела: плитки, столбцы «сделано из запланированного», сферы, «Откладывается» (SPEC 7.3). */
export function TasksReport() {
  const { tasks, taskEvents, areas } = useData();
  const today = useToday();
  const [kind, setKind] = useState<PeriodKind>('week');
  const [ref, setRef] = useState(today);
  const [dating, setDating] = useState<Task | null>(null);
  const [list, setList] = useState<{ title: string; tasks: Task[] } | null>(null);
  const { push } = useNav();
  const toast = useToast();
  const stats = useMemo(() => periodStats(kind, ref, today, tasks, taskEvents), [kind, ref, today, tasks, taskEvents]);
  // Сделанные за период — по журналу: повторяющиеся задачи остаются open, в списке они показываются как сделанные.
  const doneIds = useMemo(() => new Set(stats.lists.done.map((t) => t.id)), [stats]);
  const empty = stats.planned === 0 && stats.done === 0;
  const stalled = stalledTasks(tasks, today);
  const areaById = new Map(areas.map((a) => [a.id, a]));

  return (
    <div className="space-y-4">
      {list && <TaskListSheet title={list.title} subtitle={periodTitle(kind, stats.from, stats.to)} tasks={list.tasks} doneIds={doneIds} onClose={() => setList(null)} />}
      <Segmented
        label="Период"
        value={kind}
        onChange={(k) => {
          setKind(k);
          setRef(today);
        }}
        options={[
          { value: 'week', label: 'Неделя' },
          { value: 'month', label: 'Месяц' },
        ]}
      />
      <div className="flex items-center justify-between rounded-card bg-surface px-1">
        <button type="button" aria-label="Предыдущий период" onClick={() => setRef(shiftPeriod(kind, ref, -1))} className="flex size-11 items-center justify-center text-muted">
          <ChevronLeft size={20} aria-hidden />
        </button>
        <span className="font-semibold">{periodTitle(kind, stats.from, stats.to)}</span>
        <button
          type="button"
          aria-label="Следующий период"
          disabled={stats.current}
          onClick={() => setRef(shiftPeriod(kind, ref, 1))}
          className="flex size-11 items-center justify-center text-muted disabled:opacity-30"
        >
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Сделано', value: stats.done, cls: 'text-income', tasks: stats.lists.done },
          { label: stats.second.label, value: stats.second.value, cls: '', tasks: stats.lists.second },
          { label: 'Просрочено', value: stats.overdue, cls: stats.overdue ? 'text-warn' : '', tasks: stats.lists.overdue },
        ].map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setList({ title: t.label, tasks: t.tasks })}
            className="rounded-card bg-surface p-3 text-left active:bg-bg"
            aria-label={`${t.label}: ${t.value}`}
          >
            <p className={`tabular text-h1 font-bold ${t.cls}`}>
              <CountUp key={`${kind}-${stats.from}`} value={t.value} format={String} duration={500} />
            </p>
            <p className="text-caption text-muted">{t.label}</p>
          </button>
        ))}
      </div>

      <section className="space-y-3 rounded-card bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-h2 font-semibold">По дням</h2>
          <span className="tabular text-caption font-semibold text-muted">
            {stats.done} из {stats.planned}
          </span>
        </div>
        {empty ? (
          <p className="py-6 text-center text-muted">{kind === 'week' ? 'На этой неделе задач не было' : 'В этом месяце задач не было'}</p>
        ) : (
        <Bars
          animateKey={`${kind}-${stats.from}`}
          height={110}
          // Неделя: столбец — итог дня; месяц: столбец — эта неделя по дням.
          onPick={(key) => {
            if (kind === 'week') push({ name: 'day', date: key });
            else {
              setKind('week');
              setRef(key);
            }
          }}
          pickLabel={(b) => `${b.label}: ${b.top || 'нет задач'}${kind === 'week' ? '. Открыть день' : '. Открыть неделю'}`}
          items={stats.bars.map((b) => ({ key: b.key, label: b.label, value: b.planned, inner: b.done, top: b.planned ? `${b.done}/${b.planned}` : '', bold: b.today }))}
        />
        )}
      </section>

      {stats.areas.length > 0 && (
        <section className="space-y-3 rounded-card bg-surface p-4">
          <h2 className="text-h2 font-semibold">По сферам</h2>
          {stats.areas.map((s) => {
            const a = s.areaId ? areaById.get(s.areaId) : undefined;
            const color = a?.color ?? '#5B6170';
            return (
              <button
                key={s.areaId ?? 'none'}
                type="button"
                onClick={() => setList({ title: a?.name ?? 'Без сферы', tasks: s.tasks })}
                className="-mx-2 block w-[calc(100%+16px)] space-y-1.5 rounded-ctl px-2 py-1 text-left active:bg-bg"
              >
                <div className="flex items-center gap-2">
                  <IconCircle name={a?.icon ?? 'Ellipsis'} color={color} size={28} />
                  <span className="flex-1">{a?.name ?? 'Без сферы'}</span>
                  <span className="tabular text-caption text-muted">
                    {s.done} из {s.planned}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-[2px] bg-line">
                  <div className="h-full rounded-[2px]" style={{ width: `${s.planned ? Math.round((s.done * 100) / s.planned) : 0}%`, background: color }} />
                </div>
              </button>
            );
          })}
        </section>
      )}

      {stalled.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-h2 font-semibold">Откладывается</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface" aria-label="Откладывается">
            {stalled.map((t) => (
              <li key={t.id} className="space-y-2 px-4 py-3">
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-caption font-medium text-warn">{taskWarning(t, today)}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => (t.date ? void applyTaskChange(rescheduleTask(t, today, Date.now())) : setDating(t))}
                    className="min-h-11 rounded-ctl bg-primary text-caption font-semibold text-white"
                  >
                    {t.date ? 'Сделать сегодня' : 'Назначить дату'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void applyTaskChange(deleteTask(t, Date.now()));
                      toast({ message: 'Задача удалена', actionLabel: 'Отменить', onAction: () => void applyTaskChange({ task: t, events: [] }) });
                    }}
                    className="min-h-11 rounded-ctl bg-bg text-caption font-semibold text-warn ring-1 ring-line"
                  >
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {dating && <PostponeSheet task={dating} onPick={(d) => void applyTaskChange(rescheduleTask(dating, d, Date.now()))} onClose={() => setDating(null)} />}
    </div>
  );
}
