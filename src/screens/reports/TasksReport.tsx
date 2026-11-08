import { ChevronLeft, ChevronRight, Flag } from '../../ui/glyphs';
import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useNav, useToday } from '../../app/nav';
import { useToast } from '../../ui/Toast';
import { applyTaskChange } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { formatMonthKey, formatShortDate, monthOf, parseLocalDate } from '../../domain/date';
import { burnupCaption, deleteTask, periodStats, rescheduleTask, shiftPeriod, stalledTasks, taskWarning, type PeriodKind, type PeriodStats } from '../../domain/tasks';
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

/** Отчёты → Дела (SPEC 7.3): нарастание плана и сделанного с важными, четыре плитки, строка итога, сферы, «Откладывается». */
export function TasksReport() {
  const { tasks, taskEvents, areas } = useData();
  const today = useToday();
  const [kind, setKind] = useState<PeriodKind>('week');
  const [ref, setRef] = useState(today);
  const [dating, setDating] = useState<Task | null>(null);
  const [list, setList] = useState<{ title: string; tasks: Task[] } | null>(null);
  /** Выбранный день (неделя месяца); null — по умолчанию: сегодня, в прошлом периоде — последний. */
  const [selKey, setSelKey] = useState<string | null>(null);
  const { push } = useNav();
  const toast = useToast();
  const stats = useMemo(() => periodStats(kind, ref, today, tasks, taskEvents), [kind, ref, today, tasks, taskEvents]);
  // Сделанные за период — по журналу: повторяющиеся задачи остаются open, в списке они показываются как сделанные.
  const doneIds = useMemo(() => new Set(stats.lists.done.map((t) => t.id)), [stats]);
  const empty = stats.planned === 0 && stats.done === 0;
  const found = selKey ? stats.cols.findIndex((c) => c.key === selKey) : -1;
  const sel = found >= 0 ? found : stats.defaultIndex;
  // Тап по дню — выбрать его; повторный по выбранному — экран дня (неделя) или эта неделя по дням (месяц), 7b.
  const pick = (i: number) => {
    const col = stats.cols[i]!;
    if (i !== sel) return setSelKey(col.key);
    if (kind === 'week') push({ name: 'day', date: col.key });
    else {
      setKind('week');
      setRef(col.key);
      setSelKey(null);
    }
  };
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
          setSelKey(null);
        }}
        options={[
          { value: 'week', label: 'Неделя' },
          { value: 'month', label: 'Месяц' },
        ]}
      />
      <div className="-mt-2 flex items-center justify-center gap-2">
        <button type="button" aria-label="Предыдущий период" onClick={() => { setRef(shiftPeriod(kind, ref, -1)); setSelKey(null); }} className="flex size-11 items-center justify-center text-muted">
          <ChevronLeft size={20} aria-hidden />
        </button>
        <span className="min-w-[140px] text-center font-semibold">{periodTitle(kind, stats.from, stats.to)}</span>
        <button
          type="button"
          aria-label="Следующий период"
          disabled={stats.current}
          onClick={() => {
            setRef(shiftPeriod(kind, ref, 1));
            setSelKey(null);
          }}
          className="flex size-11 items-center justify-center text-muted disabled:text-line"
        >
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>

      <section className="card p-4" aria-label="Нарастание дел">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="display-num text-[20px]">
            {stats.done} из {stats.planned}
          </span>
          <span className="text-caption text-muted">сделано</span>
          <Legend />
        </div>
        {empty ? (
          <p className="py-6 text-center text-[14px] text-muted">{kind === 'week' ? 'На этой неделе задач не было' : 'В этом месяце задач не было'}</p>
        ) : (
          <Burnup stats={stats} sel={sel} onPick={pick} />
        )}
        {/* Четыре плитки в ряд: на 375–390 px «Не сделано» и «просрочено» помещаются только с узкими отступами. */}
        <div className="mt-3 grid grid-cols-4 gap-1">
          {[
            { label: 'Было', value: stats.planned, sub: 'в плане', cls: 'text-ink', tasks: stats.lists.planned },
            { label: 'Сделано', value: stats.done, sub: `из ${stats.planned}`, cls: 'text-income', tasks: stats.lists.done },
            { label: 'Не сделано', value: stats.missed, sub: 'просрочено', cls: stats.missed ? 'text-warn' : 'text-muted', tasks: stats.lists.missed },
            { label: 'Важных', value: stats.important, sub: `сделано ${stats.importantDone}`, cls: 'text-accent', tasks: stats.lists.important },
          ].map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setList({ title: t.label, tasks: t.tasks })}
              className="min-w-0 rounded-[14px] bg-sunk px-1.5 pt-2.5 pb-2 text-left"
              aria-label={`${t.label}: ${t.value}, ${t.sub}`}
            >
              <span className="block truncate text-[11px] tracking-tight text-muted">{t.label}</span>
              <span className={`display-num block text-[18px] ${t.cls}`}>{t.value}</span>
              <span className="block truncate text-[11px] tracking-tight text-muted">{t.sub}</span>
            </button>
          ))}
        </div>
        {!empty && <Caption stats={stats} sel={sel} />}
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

/** «● сделано ○ план ▪ отставание». */
function Legend() {
  return (
    <span className="ml-auto flex items-center gap-2.5 text-[12px] text-muted" aria-hidden>
      <span className="flex items-center gap-1">
        <span className="size-2 rounded-full bg-primary" />
        сделано
      </span>
      <span className="flex items-center gap-1">
        <span className="size-2 rounded-full ring-[1.5px] ring-muted ring-inset" />
        план
      </span>
      <span className="flex items-center gap-1">
        <span className="size-2 rounded-[2px] bg-warn/25" />
        отставание
      </span>
    </span>
  );
}

/** Строка итога выбранного дня (недели): «Сегодня, 4 ноября» · «к этому дню 7 из 11 · отстаю на 4 · важных 2, сделано 1». */
function Caption({ stats, sel }: { stats: PeriodStats; sel: number }) {
  const c = burnupCaption(stats, sel);
  return (
    <p className="tabular mt-2.5 flex justify-between gap-3 rounded-[14px] bg-sunk px-3 py-2.5 text-[13px]" aria-live="polite" data-burnup-caption>
      <span className="shrink-0 font-semibold">{c.title}</span>
      <span className={`text-right ${c.warn ? 'text-warn' : 'text-muted'}`}>{c.text}</span>
    </p>
  );
}

const CHART_H = 140;

/**
 * Нарастание (этап 30): пунктир — накопленный план, линия с точками — накопленное сделанное до сегодня, между ними там, где
 * сделано меньше плана, — заливка отставания; план после сегодня — бледный пунктир. Выбранный день — вертикаль и точка
 * --accent. Точки стоят над серединами подписей; ширина — по контейнеру (ResizeObserver), без растяжения SVG. Без анимаций.
 */
function Burnup({ stats, sel, onPick }: { stats: PeriodStats; sel: number; onPick: (i: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const n = stats.cols.length;
  const top = Math.max(1, stats.cum[n - 1]?.plan ?? 1);
  const X = (i: number) => ((i + 0.5) * w) / n;
  const Y = (v: number) => CHART_H - 6 - (v / top) * (CHART_H - 16);
  const last = stats.lastDone;
  const line = (key: 'plan' | 'done', from: number, to: number) =>
    stats.cum
      .slice(from, to + 1)
      .map((c, k) => `${k ? 'L' : 'M'}${X(from + k).toFixed(1)} ${Y(c[key]).toFixed(1)}`)
      .join(' ');
  const gap =
    last >= 0
      ? `${line('plan', 0, last)} ${stats.cum
          .slice(0, last + 1)
          .map((c, i) => `L${X(i).toFixed(1)} ${Y(c.done).toFixed(1)}`)
          .reverse()
          .join(' ')} Z`
      : '';
  // Тап по графику — день под пальцем.
  const pickAt = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onPick(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * n))));
  };
  return (
    <div className="mt-3">
      <div ref={box} onClick={pickAt} className="cursor-pointer" style={{ height: CHART_H }} aria-hidden>
        {w > 0 && (
          <svg width={w} height={CHART_H} viewBox={`0 0 ${w} ${CHART_H}`} className="overflow-visible">
            {gap && <path d={gap} fill="var(--warn)" fillOpacity={0.14} />}
            {last >= 0 && <path d={line('plan', 0, last)} fill="none" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 4" />}
            {last < n - 1 && <path d={line('plan', Math.max(0, last), n - 1)} fill="none" stroke="var(--muted)" strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="2 5" strokeLinecap="round" />}
            <line x1={X(sel)} x2={X(sel)} y1={0} y2={CHART_H} stroke="var(--accent)" strokeWidth={1.5} />
            {last >= 0 && <path d={line('done', 0, last)} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
            {stats.cum.slice(0, last + 1).map((c, i) =>
              i === sel ? null : <circle key={i} cx={X(i)} cy={Y(c.done)} r={3.5} fill="var(--primary)" stroke="var(--surface)" strokeWidth={1.5} />,
            )}
            {sel <= last && <circle cx={X(sel)} cy={Y(stats.cum[sel]!.done)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />}
          </svg>
        )}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {stats.cols.map((c, i) => {
          const strong = c.current || i === sel;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onPick(i)}
              aria-pressed={i === sel}
              aria-label={`${c.title}: сделано ${c.done} из ${c.plan}${c.important ? `, важных ${c.important}` : ''}`}
              className="flex min-h-11 min-w-0 flex-col items-center gap-0.5 pt-1.5"
            >
              <span className={`text-[12px] whitespace-nowrap ${strong ? 'font-bold text-ink' : 'text-muted'}`}>{c.label}</span>
              <span
                className={`flex h-3.5 items-center gap-0.5 text-[11px] font-bold ${c.important > c.importantDone && c.past ? 'text-warn' : 'text-accent'} ${c.important ? '' : 'invisible'}`}
              >
                <Flag size={10} aria-hidden />
                {c.important}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

