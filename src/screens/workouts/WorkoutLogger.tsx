import { CalendarDays, Plus, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToday } from '../../app/nav';
import { deleteWorkout, saveWorkout } from '../../data/workouts';
import { useData } from '../../data/DataProvider';
import { formatRelativeDate } from '../../domain/date';
import type { Exercise, Id, Workout, WorkoutSet } from '../../domain/types';
import {
  describeSets, estimatedMax, formatDuration, formatMax, formatWeight, lastSession, pacePer100, parseDuration, parseWeight, previousBestMax,
} from '../../domain/workouts';
import { Chip, TextInput } from '../../ui/controls';
import { useToast } from '../../ui/Toast';
import { DatePicker } from '../entry/pickers';
import { ExercisePicker } from './ExercisePicker';

interface SetDraft {
  key: string;
  weight: string;
  reps: string;
}
interface Block {
  exerciseId: Id;
  sets: SetDraft[];
}

const key = () => crypto.randomUUID();
const toDraft = (s: Pick<WorkoutSet, 'weightG' | 'reps'>): SetDraft => ({ key: key(), weight: formatWeight(s.weightG), reps: String(s.reps) });

function parseSet(s: SetDraft): { weightG: number; reps: number } | null {
  if (!s.weight.trim() && !s.reps.trim()) return null;
  const weightG = s.weight.trim() ? parseWeight(s.weight) : 0;
  const reps = /^\d{1,3}$/.test(s.reps.trim()) ? Number(s.reps.trim()) : NaN;
  return weightG !== null && reps > 0 ? { weightG, reps } : null;
}

/** Запись тренировки в зале или бассейне — полноэкранная модалка (SPEC 7a.2). */
export function WorkoutLogger({ type, workout, onClose }: { type: Workout['type']; workout?: Workout; onClose: () => void }) {
  const data = useData();
  const today = useToday();
  const toast = useToast();
  const [date, setDate] = useState(workout?.date ?? today);
  const [picker, setPicker] = useState<'date' | 'exercise' | null>(null);
  const [blocks, setBlocks] = useState<Block[]>(() => {
    if (!workout) return [];
    const own = data.workoutSets.filter((s) => s.workoutId === workout.id).sort((a, b) => a.order - b.order);
    const order: Id[] = [];
    for (const s of own) if (!order.includes(s.exerciseId)) order.push(s.exerciseId);
    return order.map((exerciseId) => ({ exerciseId, sets: own.filter((s) => s.exerciseId === exerciseId).map(toDraft) }));
  });
  const [distance, setDistance] = useState(workout?.distanceM ? String(workout.distanceM) : '');
  const [duration, setDuration] = useState(workout?.durationS ? formatDuration(workout.durationS) : '');
  const [note, setNote] = useState(workout?.note ?? '');

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const exerciseById = new Map(data.exercises.map((e) => [e.id, e]));
  const addExercise = (e: Exercise) => {
    const last = lastSession(e.id, data.workouts, data.workoutSets, workout?.id);
    setBlocks((b) => [...b, { exerciseId: e.id, sets: last ? last.sets.map(toDraft) : [{ key: key(), weight: '', reps: '' }] }]);
  };
  const updateSet = (bi: number, si: number, patch: Partial<SetDraft>) =>
    setBlocks((b) => b.map((x, i) => (i !== bi ? x : { ...x, sets: x.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) })));

  const distanceM = /^\d{1,6}$/.test(distance.trim()) ? Number(distance.trim()) : 0;
  const durationS = duration.trim() ? parseDuration(duration) : null;
  const pace = distanceM && durationS ? pacePer100(distanceM, durationS) : null;
  const parsedBlocks = blocks.map((b) => ({ exerciseId: b.exerciseId, sets: b.sets.map(parseSet).filter((s): s is NonNullable<typeof s> => s !== null) }));
  const valid = type === 'gym' ? parsedBlocks.some((b) => b.sets.length > 0) : distanceM > 0 && (!duration.trim() || durationS !== null);

  const records = parsedBlocks.filter((b) => {
    const prev = previousBestMax(b.exerciseId, data.workouts, data.workoutSets, workout?.id);
    return prev > 0 && Math.max(0, ...b.sets.map((s) => estimatedMax(s.weightG, s.reps))) > prev;
  });

  const save = async () => {
    if (!valid) return;
    const now = Date.now();
    const w: Workout = {
      id: workout?.id ?? crypto.randomUUID(),
      date,
      type,
      createdAt: workout?.createdAt ?? now,
      updatedAt: now,
      ...(type === 'pool' ? { distanceM, ...(durationS ? { durationS } : {}) } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    let order = 0;
    const sets: WorkoutSet[] =
      type === 'gym'
        ? parsedBlocks.flatMap((b) => b.sets.map((s) => ({ id: crypto.randomUUID(), workoutId: w.id, exerciseId: b.exerciseId, order: order++, ...s })))
        : [];
    await saveWorkout(w, sets);
    onClose();
    const recordNames = records.map((r) => exerciseById.get(r.exerciseId)?.name).filter(Boolean);
    toast({ message: recordNames.length ? `Рекорд: ${recordNames.join(', ')}` : 'Тренировка записана' });
  };

  const remove = async () => {
    if (!workout) return;
    onClose();
    const deleted = await deleteWorkout(workout.id);
    if (deleted) toast({ message: 'Тренировка удалена', actionLabel: 'Отменить', onAction: () => void saveWorkout(deleted.workout, deleted.sets) });
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="workout-title" className="pt-safe pb-safe fixed inset-0 z-30 mx-auto flex max-w-lg flex-col bg-bg">
      <div className="relative flex h-14 shrink-0 items-center justify-center px-2">
        <button type="button" onClick={onClose} className="absolute left-2 min-h-11 px-3 font-medium text-accent">
          Отмена
        </button>
        <h2 id="workout-title" className="text-h2 font-semibold">
          {type === 'gym' ? 'Зал' : 'Бассейн'}
        </h2>
        {workout && (
          <button type="button" onClick={() => void remove()} className="absolute right-2 min-h-11 px-3 font-medium text-warn">
            Удалить
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        <Chip onClick={() => setPicker('date')} aria-label={`Дата: ${formatRelativeDate(date, today)}`}>
          <CalendarDays size={16} aria-hidden /> {formatRelativeDate(date, today)}
        </Chip>

        {type === 'gym' &&
          blocks.map((b, bi) => {
            const ex = exerciseById.get(b.exerciseId);
            const last = lastSession(b.exerciseId, data.workouts, data.workoutSets, workout?.id);
            const isRecord = records.some((r) => r.exerciseId === b.exerciseId);
            const best = Math.max(0, ...(parsedBlocks[bi]?.sets ?? []).map((s) => estimatedMax(s.weightG, s.reps)));
            return (
              <section key={`${b.exerciseId}-${bi}`} className="space-y-2 rounded-card bg-surface p-4" aria-label={ex?.name}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{ex?.name ?? 'Тренажёр'}</h3>
                    <p className="text-caption text-muted">{last ? `Прошлый раз: ${describeSets(last.sets)}` : 'Первый раз на этом тренажёре'}</p>
                  </div>
                  {isRecord && (
                    <span className="flex items-center gap-1 rounded-[4px] bg-income/15 px-2 py-1 text-caption font-semibold text-income">
                      <Trophy size={14} aria-hidden /> Рекорд
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Убрать ${ex?.name ?? 'тренажёр'}`}
                    onClick={() => setBlocks((x) => x.filter((_, i) => i !== bi))}
                    className="-mt-2 -mr-2 flex size-11 items-center justify-center text-muted"
                  >
                    <X size={18} aria-hidden />
                  </button>
                </div>
                {b.sets.map((s, si) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <span className="tabular w-5 text-caption text-muted">{si + 1}</span>
                    <label className="flex flex-1 items-center gap-1.5">
                      <span className="sr-only">Вес, подход {si + 1}</span>
                      <TextInput inputMode="decimal" value={s.weight} placeholder="0" onChange={(e) => updateSet(bi, si, { weight: e.target.value })} />
                      <span className="text-caption text-muted">кг</span>
                    </label>
                    <span className="text-muted">×</span>
                    <label className="flex w-24 items-center gap-1.5">
                      <span className="sr-only">Повторы, подход {si + 1}</span>
                      <TextInput inputMode="numeric" value={s.reps} placeholder="0" onChange={(e) => updateSet(bi, si, { reps: e.target.value })} />
                    </label>
                    <button
                      type="button"
                      aria-label={`Удалить подход ${si + 1}`}
                      onClick={() => setBlocks((x) => x.map((y, i) => (i !== bi ? y : { ...y, sets: y.sets.filter((_, j) => j !== si) })))}
                      className="flex size-11 shrink-0 items-center justify-center text-muted"
                    >
                      <X size={16} aria-hidden />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setBlocks((x) =>
                        x.map((y, i) => {
                          if (i !== bi) return y;
                          const lastSet = y.sets[y.sets.length - 1];
                          return { ...y, sets: [...y.sets, { key: key(), weight: lastSet?.weight ?? '', reps: lastSet?.reps ?? '' }] };
                        }),
                      )
                    }
                    aria-label="Добавить подход"
                    className="flex min-h-11 items-center gap-1 font-medium text-accent"
                  >
                    <Plus size={16} aria-hidden /> подход
                  </button>
                  {best > 0 && <span className="tabular text-caption text-muted">макс. ≈ {formatMax(best)} кг</span>}
                </div>
              </section>
            );
          })}

        {type === 'gym' && (
          <button
            type="button"
            onClick={() => setPicker('exercise')}
            className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-card bg-surface font-semibold text-accent ring-1 ring-line"
          >
            <Plus size={18} aria-hidden /> Тренажёр
          </button>
        )}

        {type === 'pool' && (
          <section className="space-y-4 rounded-card bg-surface p-4">
            <label className="block space-y-1.5">
              <span className="block text-caption text-muted">Дистанция, м</span>
              <TextInput inputMode="numeric" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="1000" />
            </label>
            <div className="flex gap-2">
              {[500, 1000, 1500, 2000].map((m) => (
                <Chip key={m} selected={distanceM === m} onClick={() => setDistance(String(m))}>
                  {m.toLocaleString('ru-RU')}
                </Chip>
              ))}
            </div>
            <label className="block space-y-1.5">
              <span className="block text-caption text-muted">Время, мм:сс</span>
              <TextInput inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="32:00" />
            </label>
            <p className="tabular text-h2 font-semibold" aria-live="polite">
              {pace ? `Темп ${formatDuration(pace)} на 100 м` : <span className="text-caption font-normal text-muted">Темп посчитается сам</span>}
            </p>
          </section>
        )}

        <label className="block space-y-1.5">
          <span className="block text-caption text-muted">Заметка</span>
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === 'gym' ? 'Ноги + спина' : 'Кроль, 25-метровый'} />
        </label>
      </div>

      <div className="px-4 pt-1 pb-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!valid}
          className="h-14 w-full rounded-card bg-primary text-[17px] font-semibold text-white active:opacity-80 disabled:bg-line disabled:text-muted"
        >
          Сохранить
        </button>
      </div>

      {picker === 'date' && <DatePicker value={date} today={today} onPick={setDate} onClose={() => setPicker(null)} />}
      {picker === 'exercise' && (
        <ExercisePicker exercises={data.exercises} exclude={blocks.map((b) => b.exerciseId)} onPick={addExercise} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}
