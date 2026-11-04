import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { createExercise } from '../../data/workouts';
import type { Exercise, Id } from '../../domain/types';
import { Chip, Row } from '../../ui/controls';
import { Icon } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';

const SUGGESTIONS = ['Жим ногами', 'Тяга верхнего блока', 'Жим от груди', 'Тяга горизонтального блока', 'Разгибание ног', 'Сгибание ног', 'Бабочка', 'Жим вверх'];

/** Выбор тренажёра; новый создаётся по названию (SPEC 7a.2). */
export function ExercisePicker({
  exercises,
  exclude,
  onPick,
  onClose,
}: {
  exercises: readonly Exercise[];
  exclude: readonly Id[];
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const active = exercises.filter((e) => !e.archived && !exclude.includes(e.id));
  const shown = active.filter((e) => !q || e.name.toLowerCase().includes(q));
  const exact = exercises.some((e) => e.name.toLowerCase() === q);
  const suggestions = SUGGESTIONS.filter((s) => !exercises.some((e) => e.name === s) && (!q || s.toLowerCase().includes(q)));

  const create = async (name: string) => {
    onPick(await createExercise(name));
    onClose();
  };

  return (
    <Sheet title="Тренажёр" onClose={onClose} full>
      <div className="space-y-4">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти или назвать новый"
            aria-label="Название тренажёра"
            className="block min-h-11 w-full rounded-xl bg-bg pr-3 pl-10 ring-1 ring-line outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        {q && !exact && (
          <button type="button" onClick={() => void create(query)} className="flex min-h-12 w-full items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-white">
            <Plus size={18} aria-hidden /> Создать «{query.trim()}»
          </button>
        )}
        {shown.length > 0 && (
          <div className="divide-y divide-line">
            {shown.map((e) => (
              <Row
                key={e.id}
                className="px-0"
                onClick={() => {
                  onPick(e);
                  onClose();
                }}
              >
                <Icon name={e.icon} size={22} className="text-accent" />
                <span className="flex-1">{e.name}</span>
              </Row>
            ))}
          </div>
        )}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-caption text-muted">Часто встречаются</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <Chip key={s} onClick={() => void create(s)}>
                  <Plus size={14} aria-hidden /> {s}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
