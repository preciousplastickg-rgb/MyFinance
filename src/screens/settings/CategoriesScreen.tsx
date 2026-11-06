import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useData } from '../../data/DataProvider';
import { reorder } from '../../data/actions';
import { formatAmount } from '../../domain/money';
import type { Category } from '../../domain/types';
import { ListGroup, Row, Segmented } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { SortableList } from '../../ui/SortableList';
import { SubScreen } from '../../ui/SubScreen';
import { CategoryEditor } from './CategoryEditor';

export function CategoriesScreen() {
  const { categories } = useData();
  const [kind, setKind] = useState<Category['kind']>('expense');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const ofKind = categories.filter((c) => c.kind === kind);
  const active = ofKind.filter((c) => !c.archived);
  const archived = ofKind.filter((c) => c.archived);

  const row = (c: Category) => (
    <Row onClick={() => setEditing(c)} className="pr-1">
      <IconCircle name={c.icon} color={c.color} />
      <span className="min-w-0 flex-1 truncate">{c.name}</span>
      {(c.isFixed || !!c.limit) && (
        <span className="tabular shrink-0 text-caption text-muted">{[c.isFixed ? 'обязательный' : '', c.limit ? `${formatAmount(c.limit)} в месяц` : ''].filter(Boolean).join(' · ')}</span>
      )}
    </Row>
  );

  return (
    <SubScreen
      title="Категории"
      back="Настройки"
      action={
        <button
          type="button"
          aria-label="Новая категория"
          onClick={() => setEditing('new')}
          className="flex size-11 items-center justify-center rounded-ctl text-accent active:bg-line"
        >
          <Plus size={24} aria-hidden />
        </button>
      }
    >
      <Segmented
        label="Тип категорий"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'expense', label: 'Расходы' },
          { value: 'income', label: 'Доходы' },
        ]}
      />
      <SortableList
        items={active}
        itemLabel={(c) => c.name}
        onReorder={(ids) => {
          const others = categories.filter((c) => !ids.includes(c.id)).map((c) => c.id);
          void reorder('categories', [...ids, ...others]);
        }}
        renderItem={row}
      />
      {archived.length > 0 && <ListGroup title="Архив">{archived.map((c) => <div key={c.id}>{row(c)}</div>)}</ListGroup>}
      {editing && (
        <CategoryEditor category={editing === 'new' ? undefined : editing} kind={kind} onClose={() => setEditing(null)} />
      )}
    </SubScreen>
  );
}
