import { Search } from 'lucide-react';
import { useState } from 'react';
import { ICON_KEYWORDS, searchIcons, tint } from '../domain/catalog';
import { Icon } from './icons';

/** Сетка значков 6 в ряд с поиском по русским ключевым словам (SPEC 5.4). */
export function IconPicker({ value, color, onChange }: { value: string; color: string; onChange: (name: string) => void }) {
  const [query, setQuery] = useState('');
  const icons = searchIcons(query);
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск: такси, аптека, кино…"
          aria-label="Поиск значка"
          className="block min-h-11 w-full rounded-xl bg-bg pr-3 pl-10 text-body ring-1 ring-line outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      {icons.length === 0 ? (
        <p className="py-4 text-center text-caption text-muted">Ничего не нашлось</p>
      ) : (
        <div role="radiogroup" aria-label="Значок" className="grid grid-cols-6 gap-1">
          {icons.map((name) => {
            const selected = name === value;
            return (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={ICON_KEYWORDS[name]!.split(' ')[0]}
                onClick={() => onChange(name)}
                className="flex aspect-square min-h-11 items-center justify-center rounded-xl"
                style={selected ? { background: tint(color), color, boxShadow: `inset 0 0 0 2px ${color}` } : undefined}
              >
                <Icon name={name} size={22} className={selected ? '' : 'text-ink'} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
