import { Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { formatShortDate, parseLocalDate } from '../../domain/date';
import { describeSets, exerciseHistory, formatDuration, formatMax, formatWeight, poolStats } from '../../domain/workouts';
import { Bars, LineChart } from '../../ui/charts';
import { Chip, Segmented } from '../../ui/controls';

type Metric = 'max' | 'top' | 'volume';

/** Прогрессия по тренажёрам и в бассейне (SPEC 7a.2). */
export function WorkoutsProgress() {
  const { exercises, workouts, workoutSets } = useData();
  const today = useToday();
  const used = exercises.filter((e) => workoutSets.some((s) => s.exerciseId === e.id));
  const [exerciseId, setExerciseId] = useState(used[0]?.id ?? '');
  const [metric, setMetric] = useState<Metric>('max');
  const current = used.find((e) => e.id === exerciseId) ?? used[0];
  const history = useMemo(() => (current ? exerciseHistory(current.id, workouts, workoutSets) : []), [current, workouts, workoutSets]);
  const pool = useMemo(() => poolStats(workouts, today), [workouts, today]);
  const hasPool = pool.sessions.length > 0;

  if (!used.length && !hasPool) return null;
  const value = (s: (typeof history)[number]) => (metric === 'max' ? s.bestMaxG : metric === 'top' ? s.topWeightG : s.volumeKg);
  const fmt = (v: number) => (metric === 'volume' ? `${v.toLocaleString('ru-RU')}` : formatWeight(Math.round(v / 100) * 100));
  const last = history[history.length - 1];
  const bestMax = Math.max(0, ...history.map((s) => s.bestMaxG));

  return (
    <div className="space-y-4">
      {current && (
        <section className="space-y-3 rounded-card bg-surface p-4">
          <h2 className="text-h2 font-semibold">Тренажёры</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Тренажёр">
            {used.map((e) => (
              <Chip key={e.id} selected={e.id === current.id} onClick={() => setExerciseId(e.id)}>
                {e.name}
              </Chip>
            ))}
          </div>
          <Segmented
            label="Показатель"
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'max', label: 'Макс. на 1' },
              { value: 'top', label: 'Рабочий вес' },
              { value: 'volume', label: 'Объём' },
            ]}
          />
          <LineChart
            label={`${current.name}: ${metric === 'max' ? 'расчётный максимум' : metric === 'top' ? 'рабочий вес' : 'объём'} по тренировкам`}
            points={history.map((s) => ({ label: formatShortDate(s.date), value: value(s), mark: s.record }))}
            format={fmt}
          />
          <div className="grid grid-cols-2 gap-2 text-caption">
            <div className="rounded-ctl bg-bg p-3">
              <p className="text-muted">Лучший максимум</p>
              <p className="tabular text-h2 font-semibold">≈ {formatMax(bestMax)} кг</p>
            </div>
            <div className="rounded-ctl bg-bg p-3">
              <p className="text-muted">Последняя</p>
              <p className="tabular font-semibold">{last ? describeSets(last.sets) : '—'}</p>
            </div>
          </div>
          <ul className="space-y-1.5 text-caption" aria-label="История тренажёра">
            {[...history].reverse().slice(0, 6).map((s) => (
              <li key={s.workoutId} className="flex items-center justify-between gap-2">
                <span className="text-muted">{formatShortDate(s.date)}</span>
                <span className="tabular flex-1 truncate text-right">{describeSets(s.sets)}</span>
                {s.record && <Trophy size={14} className="shrink-0 text-income" aria-label="Рекорд" />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasPool && (
        <section className="space-y-3 rounded-card bg-surface p-4">
          <h2 className="text-h2 font-semibold">Бассейн</h2>
          <Bars
            height={90}
            color="var(--crypto)"
            items={pool.weeks.map((w, i) => ({
              key: w.monday,
              label: `${parseLocalDate(w.monday).day}.${String(parseLocalDate(w.monday).month).padStart(2, '0')}`,
              value: w.distanceM,
              top: w.distanceM ? `${(w.distanceM / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}к` : '',
              bold: i === pool.weeks.length - 1,
            }))}
          />
          <p className="text-caption text-muted">Метров за неделю, последние 8 недель</p>
          <div className="grid grid-cols-2 gap-2 text-caption">
            <div className="rounded-ctl bg-bg p-3">
              <p className="text-muted">Лучший темп</p>
              <p className="tabular text-h2 font-semibold">{pool.bestPace ? `${formatDuration(pool.bestPace.pace)} / 100 м` : '—'}</p>
              {pool.bestPace && <p className="text-muted">{formatShortDate(pool.bestPace.workout.date)}</p>}
            </div>
            <div className="rounded-ctl bg-bg p-3">
              <p className="text-muted">Самая длинная</p>
              <p className="tabular text-h2 font-semibold">{pool.longest ? `${pool.longest.distanceM!.toLocaleString('ru-RU')} м` : '—'}</p>
              {pool.longest && <p className="text-muted">{formatShortDate(pool.longest.date)}</p>}
            </div>
          </div>
          {pool.sessions.filter((s) => s.pace).length > 1 && (
            <LineChart
              label="Темп на 100 м по тренировкам"
              color="var(--crypto)"
              points={pool.sessions.filter((s) => s.pace).map((s) => ({ label: formatShortDate(s.date), value: s.pace! }))}
              format={formatDuration}
            />
          )}
        </section>
      )}
    </div>
  );
}
