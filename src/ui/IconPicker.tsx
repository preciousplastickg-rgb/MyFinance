import { useState } from 'react';
import { colorCss, EMOJI, firstGrapheme, ICON_KEYWORDS, isEmoji, searchEmoji, searchIcons, tint } from '../domain/catalog';
import { Segmented } from './controls';
import { Search } from './glyphs';
import { Icon } from './icons';

const EMOJI_WORDS = new Map(EMOJI.map(([e, words]) => [e, words]));

/**
 * Сетка значков 6 в ряд с поиском по русским словам (SPEC 5.4); вкладка «Эмодзи» (этап 29) — подборка и свой эмодзи
 * с клавиатуры iPhone. Эмодзи стоит в том же цветном кружке, что и значок, поэтому не выбивается из оформления.
 */
export function IconPicker({ value, color, onChange }: { value: string; color: string; onChange: (name: string) => void }) {
  const [tab, setTab] = useState<'icons' | 'emoji'>(isEmoji(value) ? 'emoji' : 'icons');
  const [query, setQuery] = useState('');
  const [own, setOwn] = useState('');
  const items = tab === 'icons' ? searchIcons(query) : searchEmoji(query);
  const label = (name: string) => (tab === 'icons' ? ICON_KEYWORDS[name]!.split(' ')[0]! : `${name} ${EMOJI_WORDS.get(name)?.split(' ')[0] ?? ''}`.trim());
  const pickOwn = (text: string) => {
    setOwn(text);
    const e = firstGrapheme(text);
    if (e && isEmoji(e)) onChange(e);
  };

  return (
    <div className="space-y-3">
      <Segmented
        label="Вид значка"
        value={tab}
        onChange={(t) => {
          setTab(t);
          setQuery('');
        }}
        options={[
          { value: 'icons', label: 'Значки' },
          { value: 'emoji', label: 'Эмодзи' },
        ]}
      />
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === 'icons' ? 'Поиск: такси, аптека, кино…' : 'Поиск: кофе, спорт, подарки…'}
          aria-label={tab === 'icons' ? 'Поиск значка' : 'Поиск эмодзи'}
          className="block min-h-11 w-full rounded-ctl bg-bg pr-3 pl-10 text-input ring-1 ring-line outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      {tab === 'emoji' && (
        <label className="flex min-h-11 items-center gap-3 rounded-ctl bg-bg px-3.5 ring-1 ring-line">
          <span className="flex-1 text-caption text-muted">Свой эмодзи — с клавиатуры 🌐</span>
          <input
            value={own}
            onChange={(e) => pickOwn(e.target.value)}
            aria-label="Свой эмодзи"
            placeholder="😀"
            className="h-11 w-16 bg-transparent text-center text-num-l outline-none"
          />
        </label>
      )}
      {items.length === 0 ? (
        <p className="py-4 text-center text-caption text-muted">Ничего не нашлось</p>
      ) : (
        <div role="radiogroup" aria-label={tab === 'icons' ? 'Значок' : 'Эмодзи'} className="grid grid-cols-6 gap-1">
          {items.map((name) => {
            const selected = name === value;
            return (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={label(name)}
                onClick={() => onChange(name)}
                className="flex aspect-square min-h-11 items-center justify-center rounded-ctl active:scale-90"
                style={selected ? { background: tint(color), color: colorCss(color), boxShadow: `inset 0 0 0 2px ${colorCss(color)}` } : undefined}
              >
                <Icon name={name} size={tab === 'icons' ? 24 : 26} className={selected || tab === 'emoji' ? '' : 'text-ink'} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
