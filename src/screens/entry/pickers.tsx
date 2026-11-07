import { Check, Plus } from '../../ui/glyphs';
import { useState } from 'react';
import { addDays, formatShortDate } from '../../domain/date';
import { formatMoney } from '../../domain/money';
import type { Account, Category, Id, LocalDate, Minor } from '../../domain/types';
import { Button, Field, Row, TextInput } from '../../ui/controls';
import { Icon, IconCircle } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { isBase } from '../../domain/currency';
import { colorCss, tint } from '../../domain/catalog';
import { CategoryEditor } from '../settings/CategoryEditor';

export function AccountPicker({
  title,
  accounts,
  balances,
  value,
  onPick,
  onClose,
}: {
  title: string;
  accounts: readonly Account[];
  balances: ReadonlyMap<Id, Minor>;
  value: Id;
  onPick: (id: Id) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="divide-y divide-line">
        {accounts.map((a) => (
          <Row
            key={a.id}
            onClick={() => {
              onPick(a.id);
              onClose();
            }}
            className="px-0"
          >
            <IconCircle name={a.icon} color={a.color} dashed={!isBase(a.currency)} />
            <span className="flex-1 font-medium">{a.name}</span>
            <span className="tabular text-muted">{formatMoney(balances.get(a.id) ?? 0, a.currency)}</span>
            <span className="w-6">{a.id === value && <Check size={20} className="text-accent" aria-label="выбран" />}</span>
          </Row>
        ))}
      </div>
    </Sheet>
  );
}

export function DatePicker({
  value,
  today,
  onPick,
  onClose,
}: {
  value: LocalDate;
  today: LocalDate;
  onPick: (date: LocalDate) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState(value);
  const pick = (d: LocalDate) => {
    onPick(d);
    onClose();
  };
  return (
    <Sheet title="Дата" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button variant={value === today ? 'primary' : 'secondary'} onClick={() => pick(today)}>
            Сегодня
          </Button>
          <Button variant={value === addDays(today, -1) ? 'primary' : 'secondary'} onClick={() => pick(addDays(today, -1))}>
            Вчера
          </Button>
        </div>
        <Field label="Другая дата">
          {(id) => <TextInput id={id} type="date" value={custom} max={addDays(today, 366)} onChange={(e) => setCustom(e.target.value)} />}
        </Field>
        <Button className="w-full" disabled={!/^\d{4}-\d{2}-\d{2}$/.test(custom)} onClick={() => pick(custom)}>
          Выбрать {/^\d{4}-\d{2}-\d{2}$/.test(custom) ? formatShortDate(custom) : ''}
        </Button>
      </div>
    </Sheet>
  );
}

export function NoteSheet({ value, onSave, onClose }: { value: string; onSave: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState(value);
  const save = () => {
    onSave(note.trim());
    onClose();
  };
  return (
    <Sheet title="Комментарий" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <TextInput autoFocus aria-label="Комментарий" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например, обед с коллегами" maxLength={200} />
        <Button type="submit" className="w-full">
          Готово
        </Button>
      </form>
    </Sheet>
  );
}

export function CategorySheet({
  categories,
  kind,
  value,
  onPick,
  onClose,
}: {
  categories: readonly Category[];
  kind: Category['kind'];
  value: Id | undefined;
  onPick: (id: Id) => void;
  onClose: () => void;
}) {
  const [creating, setCreating] = useState(false);
  if (creating) {
    // Новая категория прямо из записи: сохранили — она выбрана (этап 19).
    return (
      <CategoryEditor
        kind={kind}
        onSaved={(c) => c.kind === kind && onPick(c.id)}
        onClose={() => {
          setCreating(false);
          onClose();
        }}
      />
    );
  }
  return (
    <Sheet title="Все категории" onClose={onClose}>
      <div className="grid grid-cols-4 gap-2 pt-1">
        {categories.map((c) => (
          <CategoryTile
            key={c.id}
            variant="sheet"
            category={c}
            selected={c.id === value}
            onClick={() => {
              onPick(c.id);
              onClose();
            }}
          />
        ))}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-ctl border-[1.5px] border-line px-1 py-1"
        >
          <span className="flex size-[34px] items-center justify-center rounded-full bg-sunk text-accent">
            <Plus size={17} aria-hidden />
          </span>
          <span className="text-[12px] font-medium text-accent">Новая</span>
        </button>
      </div>
    </Sheet>
  );
}

/**
 * Плитка категории: в записи (grid) — значок цветом и подпись 13, рамка 1.5 --line, выбранная — рамка и подложка цветом;
 * в шторке «Все категории» (sheet) — значок в кружке 34 и подпись 12.
 */
export function CategoryTile({ category, selected, onClick, variant = 'grid' }: { category: Category; selected: boolean; onClick: () => void; variant?: 'grid' | 'sheet' }) {
  const color = colorCss(category.color);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex flex-col items-center justify-center rounded-ctl border-[1.5px] px-1 font-medium ${
        variant === 'grid' ? 'min-h-16 gap-1 text-caption' : 'min-h-[76px] gap-1.5 py-1 text-[12px]'
      }`}
      style={selected ? { background: tint(category.color), borderColor: color } : { borderColor: 'var(--line)' }}
    >
      {variant === 'grid' ? (
        <span style={{ color }}>
          <Icon name={category.icon} size={20} />
        </span>
      ) : (
        <IconCircle name={category.icon} color={category.color} size={34} />
      )}
      <span className="line-clamp-2 w-full text-center leading-tight">{category.name}</span>
    </button>
  );
}
