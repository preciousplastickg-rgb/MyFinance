import { Plus } from 'lucide-react';
import { useState } from 'react';
import { newId, nextSortOrder, reorder, saveArea, setArchived } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { PALETTE } from '../../domain/catalog';
import type { Area } from '../../domain/types';
import { ColorPicker } from '../../ui/ColorPicker';
import { Button, Field, ListGroup, Row, TextInput } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { IconPicker } from '../../ui/IconPicker';
import { Sheet } from '../../ui/Sheet';
import { SortableList } from '../../ui/SortableList';
import { SubScreen } from '../../ui/SubScreen';

function AreaEditor({ area, onClose }: { area?: Area; onClose: () => void }) {
  const [name, setName] = useState(area?.name ?? '');
  const [color, setColor] = useState(area?.color ?? PALETTE[0]);
  const [icon, setIcon] = useState(area?.icon ?? 'Target');
  const save = async () => {
    await saveArea({
      id: area?.id ?? newId(), name: name.trim(), icon, color,
      sortOrder: area?.sortOrder ?? (await nextSortOrder('areas')), archived: area?.archived ?? false,
    });
    onClose();
  };
  return (
    <Sheet
      title={area ? 'Сфера' : 'Новая сфера'}
      onClose={onClose}
      full
      footer={
        <Button className="w-full" disabled={!name.trim()} onClick={() => void save()}>
          Сохранить
        </Button>
      }
    >
      <div className="space-y-5 pt-2">
        <div className="flex flex-col items-center gap-2 py-2">
          <IconCircle name={icon} color={color} size={72} />
          <p className="min-h-6 text-h2 font-semibold">{name.trim() || 'Без названия'}</p>
        </div>
        <Field label="Название">{(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Учёба" />}</Field>
        <Field label="Цвет">{() => <ColorPicker value={color} onChange={setColor} />}</Field>
        <Field label="Значок">{() => <IconPicker value={icon} color={color} onChange={setIcon} />}</Field>
        {area && (
          <Button variant="danger" className="w-full" onClick={() => void setArchived('areas', area.id, !area.archived).then(onClose)}>
            {area.archived ? 'Вернуть из архива' : 'В архив'}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

export function AreasScreen() {
  const { areas } = useData();
  const [editing, setEditing] = useState<Area | 'new' | null>(null);
  const active = areas.filter((a) => !a.archived);
  const archived = areas.filter((a) => a.archived);
  const row = (a: Area) => (
    <Row onClick={() => setEditing(a)} className="pr-1">
      <IconCircle name={a.icon} color={a.color} />
      <span className="min-w-0 flex-1 truncate">{a.name}</span>
    </Row>
  );
  return (
    <SubScreen
      title="Сферы дел"
      back="Настройки"
      action={
        <button type="button" aria-label="Новая сфера" onClick={() => setEditing('new')} className="flex size-11 items-center justify-center rounded-full text-accent active:bg-line">
          <Plus size={24} aria-hidden />
        </button>
      }
    >
      <SortableList items={active} itemLabel={(a) => a.name} onReorder={(ids) => void reorder('areas', [...ids, ...archived.map((a) => a.id)])} renderItem={row} />
      {archived.length > 0 && <ListGroup title="Архив">{archived.map((a) => <div key={a.id}>{row(a)}</div>)}</ListGroup>}
      {editing && <AreaEditor area={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </SubScreen>
  );
}
