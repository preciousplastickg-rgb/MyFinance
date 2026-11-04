import { Check } from 'lucide-react';
import { useState } from 'react';
import { addDays, formatShortDate } from '../../domain/date';
import { formatMoney } from '../../domain/money';
import type { Account, Category, Id, LocalDate, Minor } from '../../domain/types';
import { Button, Field, Row, TextInput } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';

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
            <IconCircle name={a.icon} color={a.color} dashed={a.currency === 'USDT'} />
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
  value,
  onPick,
  onClose,
}: {
  categories: readonly Category[];
  value: Id | undefined;
  onPick: (id: Id) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Категория" onClose={onClose}>
      <div className="grid grid-cols-3 gap-2 pt-1">
        {categories.map((c) => (
          <CategoryTile
            key={c.id}
            category={c}
            selected={c.id === value}
            onClick={() => {
              onPick(c.id);
              onClose();
            }}
          />
        ))}
      </div>
    </Sheet>
  );
}

export function CategoryTile({ category, selected, onClick }: { category: Category; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-2xl bg-surface px-1 py-1.5"
      style={selected ? { background: `${category.color}1F`, boxShadow: `inset 0 0 0 2px ${category.color}` } : undefined}
    >
      <IconCircle name={category.icon} color={category.color} size={26} />
      <span className="w-full truncate text-center text-caption font-medium">{category.name}</span>
    </button>
  );
}
