import { ChevronLeft, ChevronRight } from '../../ui/glyphs';
import { useMemo, useState } from 'react';
import { useNav, useToday } from '../../app/nav';
import { useToast } from '../../ui/Toast';
import { applyTaskChange } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { formatMonthKey, formatShortDate, monthOf, parseLocalDate } from '../../domain/date';
import { deleteTask, periodStats, rescheduleTask, shiftPeriod, stalledTasks, taskWarning, type PeriodKind } from '../../domain/tasks';
import { Bars } from '../../ui/charts';
import { Segmented } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { PostponeSheet } from '../tasks/PostponeSheet';
import { TaskListSheet } from './TaskListSheet';
import type { Task } from '../../domain/types';
import { colorCss } from '../../domain/catalog';

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
      <div className="-mt-2 flex items-center justify-center gap-2">
        <button type="button" aria-label="Предыдущий период" onClick={() => setRef(shiftPeriod(kind, ref, -1))} className="flex size-11 items-center justify-center text-muted">
          <ChevronLeft size={20} aria-hidden />
        </button>
        <span className="min-w-[140px] text-center font-semibold">{periodTitle(kind, stats.from, stats.to)}</span>
        <button
          type="button"
          aria-label="Следующий период"
          disabled={stats.current}
          onClick={() => setRef(shiftPeriod(kind, ref, 1))}
          className="flex size-11 items-center justify-center text-muted disabled:text-line"
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
            className="card rounded-[20px] px-3.5 py-3 text-left"
            aria-label={`${t.label}: ${t.value}`}
          >
            <p className="text-[12px] text-muted">{t.label}</p>
            <p className={`display-num text-[24px] ${t.cls}`}>
              {t.value}
            </p>
          </button>
        ))}
      </div>

      <section className="card space-y-3.5 p-4">
        <h2 className="tabular font-semibold">
          {stats.done} из {stats.planned} запланированных
        </h2>
        {empty ? (
          <p className="py-6 text-center text-[14px] text-muted">{kind === 'week' ? 'На этой неделе задач не было' : 'В этом месяце задач не было'}</p>
        ) : (
        <Bars
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
        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">По сферам</h2>
          {stats.areas.map((s) => {
            const a = s.areaId ? areaById.get(s.areaId) : undefined;
            const color = colorCss(a?.color ?? 'slate');
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
                <div className="h-1.5 overflow-hidden rounded-[3px] bg-sunk">
                  <div className="h-full rounded-[3px]" style={{ width: `${s.planned ? Math.round((s.done * 100) / s.planned) : 0}%`, background: color }} />
                </div>
              </button>
            );
          })}
        </section>
      )}

      {stalled.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-h2 font-semibold">Откладывается</h2>
          <ul className="card divide-y divide-line overflow-hidden" aria-label="Откладывается">
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
                    className="min-h-11 rounded-ctl bg-primary text-caption font-semibold text-on-primary"
                  >
                    {t.date ? 'Сделать сегодня' : 'Назначить дату'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void applyTaskChange(deleteTask(t, Date.now()));
                      toast({ message: 'Задача удалена', actionLabel: 'Отменить', onAction: () => void applyTaskChange({ task: t, events: [] }) });
                    }}
                    className="min-h-11 rounded-ctl text-caption font-semibold text-warn ring-[1.5px] ring-line ring-inset"
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
