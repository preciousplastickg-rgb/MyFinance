import { ChevronRight, Dumbbell, Waves } from 'lucide-react';
import { useState } from 'react';
import { useNav, useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { formatRelativeDate } from '../../domain/date';
import type { Workout } from '../../domain/types';
import { workoutSummary } from '../../domain/workouts';
import { IconCircle } from '../../ui/icons';
import { WorkoutLogger } from './WorkoutLogger';

/** «Тренировки» на вкладке «Привычки»: Зал / Бассейн и последние тренировки (SPEC 7a.2). */
export function WorkoutsSection() {
  const { workouts, workoutSets } = useData();
  const today = useToday();
  const { showReports } = useNav();
  const [logger, setLogger] = useState<{ type: Workout['type']; workout?: Workout } | null>(null);
  const recent = [...workouts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)).slice(0, 5);

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-h2 font-semibold">Тренировки</h2>
        {workouts.length > 0 && (
          <button type="button" onClick={() => showReports('habits')} className="-mr-2 flex min-h-11 items-center gap-0.5 px-2 text-caption font-medium text-accent">
            Прогресс <ChevronRight size={16} aria-hidden />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setLogger({ type: 'gym' })} className="flex min-h-14 items-center justify-center gap-2 rounded-card bg-primary font-semibold text-white">
          <Dumbbell size={20} aria-hidden /> Зал
        </button>
        <button type="button" onClick={() => setLogger({ type: 'pool' })} className="flex min-h-14 items-center justify-center gap-2 rounded-card bg-crypto font-semibold text-white">
          <Waves size={20} aria-hidden /> Бассейн
        </button>
      </div>
      {recent.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface" aria-label="Последние тренировки">
          {recent.map((w) => (
            <li key={w.id}>
              <button type="button" onClick={() => setLogger({ type: w.type, workout: w })} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-bg">
                <IconCircle name={w.type === 'gym' ? 'Dumbbell' : 'Waves'} color={w.type === 'gym' ? '#2448D6' : '#0E7490'} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {w.type === 'gym' ? 'Зал' : 'Бассейн'} · {formatRelativeDate(w.date, today)}
                  </span>
                  <span className="tabular block truncate text-caption text-muted">{workoutSummary(w, workoutSets)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {logger && <WorkoutLogger type={logger.type} workout={logger.workout} onClose={() => setLogger(null)} />}
    </section>
  );
}
