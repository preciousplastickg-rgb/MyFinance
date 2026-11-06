import { useState } from 'react';
import { newId, nextSortOrder, saveCategory, setArchived } from '../../data/actions';
import { PALETTE } from '../../domain/catalog';
import type { Category } from '../../domain/types';
import { ColorPicker } from '../../ui/ColorPicker';
import { Button, Field, Segmented, Switch, TextInput } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { IconPicker } from '../../ui/IconPicker';
import { Sheet } from '../../ui/Sheet';

/** Редактор категории: превью 72 px, название, тип, «Обязательный расход», 8 цветов, значки (SPEC 5.4). */
export function CategoryEditor({
  category,
  kind,
  onSaved,
  onClose,
}: {
  category?: Category;
  kind: Category['kind'];
  /** Новая категория из формы записи — сразу выбрать её (этап 19). */
  onSaved?: (category: Category) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [type, setType] = useState<Category['kind']>(category?.kind ?? kind);
  const [isFixed, setIsFixed] = useState(category?.isFixed ?? false);
  const [color, setColor] = useState(category?.color ?? PALETTE[0]);
  const [icon, setIcon] = useState(category?.icon ?? 'ShoppingBag');
  const valid = name.trim() !== '';

  const save = async () => {
    if (!valid) return;
    const saved: Category = {
      id: category?.id ?? newId(),
      name: name.trim(),
      kind: type,
      icon,
      color,
      isFixed: type === 'expense' && isFixed,
      sortOrder: category?.sortOrder ?? (await nextSortOrder('categories')),
      archived: category?.archived ?? false,
    };
    await saveCategory(saved);
    onSaved?.(saved);
    onClose();
  };

  return (
    <Sheet
      title={category ? 'Категория' : 'Новая категория'}
      onClose={onClose}
      full
      footer={
        <Button className="w-full" disabled={!valid} onClick={() => void save()}>
          Сохранить
        </Button>
      }
    >
      <div className="space-y-5 pt-2">
        <div className="flex flex-col items-center gap-2 py-2">
          <IconCircle name={icon} color={color} size={72} />
          <p className="min-h-6 text-h2 font-semibold">{name.trim() || 'Без названия'}</p>
        </div>
        <Field label="Название">
          {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Такси" />}
        </Field>
        <Segmented
          label="Тип"
          value={type}
          onChange={setType}
          options={[
            { value: 'expense', label: 'Расход' },
            { value: 'income', label: 'Доход' },
          ]}
        />
        {type === 'expense' && (
          <div className="flex items-center justify-between gap-3 rounded-ctl bg-bg px-3.5 py-1">
            <div>
              <p>Обязательный расход</p>
              <p className="text-caption text-muted">Аренда, связь, подписки — для отчёта «обязательные и переменные»</p>
            </div>
            <Switch checked={isFixed} onChange={setIsFixed} label="Обязательный расход" />
          </div>
        )}
        <Field label="Цвет">{() => <ColorPicker value={color} onChange={setColor} />}</Field>
        <Field label="Значок">{() => <IconPicker value={icon} color={color} onChange={setIcon} />}</Field>
        {category && (
          <Button
            variant="danger"
            className="w-full"
            onClick={() => void setArchived('categories', category.id, !category.archived).then(onClose)}
          >
            {category.archived ? 'Вернуть из архива' : 'В архив'}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
