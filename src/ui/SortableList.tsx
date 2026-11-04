import { GripVertical } from 'lucide-react';
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

/**
 * Порядок перетаскиванием за ручку (SPEC 5.4). Строки одинаковой высоты.
 * С клавиатуры: фокус на ручке, стрелки вверх/вниз.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  itemLabel,
}: {
  items: readonly T[];
  onReorder: (ids: string[]) => void;
  renderItem: (item: T) => ReactNode;
  itemLabel: (item: T) => string;
}) {
  const [drag, setDrag] = useState<{ index: number; dy: number; height: number } | null>(null);
  const start = useRef(0);

  const targetIndex = drag
    ? Math.max(0, Math.min(items.length - 1, drag.index + Math.round(drag.dy / drag.height)))
    : -1;

  const move = (from: number, to: number) => {
    if (from === to) return;
    const ids = items.map((i) => i.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved!);
    onReorder(ids);
  };

  const onPointerDown = (index: number) => (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = e.clientY;
    const row = e.currentTarget.closest('li');
    setDrag({ index, dy: 0, height: row?.getBoundingClientRect().height ?? 56 });
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (drag) setDrag({ ...drag, dy: e.clientY - start.current });
  };
  const onPointerUp = () => {
    if (drag) move(drag.index, targetIndex);
    setDrag(null);
  };
  const onKeyDown = (index: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      move(index, index - 1);
    } else if (e.key === 'ArrowDown' && index < items.length - 1) {
      e.preventDefault();
      move(index, index + 1);
    }
  };

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
      {items.map((item, index) => {
        let offset = 0;
        if (drag) {
          if (index === drag.index) offset = drag.dy;
          else if (drag.index < index && index <= targetIndex) offset = -drag.height;
          else if (targetIndex <= index && index < drag.index) offset = drag.height;
        }
        const dragging = drag?.index === index;
        return (
          <li
            key={item.id}
            className={`relative flex items-center bg-surface ${dragging ? 'z-10 shadow-lg' : 'transition-transform duration-150'}`}
            style={{ transform: offset ? `translateY(${offset}px)` : undefined }}
          >
            <div className="min-w-0 flex-1">{renderItem(item)}</div>
            <button
              type="button"
              aria-label={`Переместить ${itemLabel(item)}`}
              onPointerDown={onPointerDown(index)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setDrag(null)}
              onKeyDown={onKeyDown(index)}
              className="flex min-h-13 w-11 shrink-0 cursor-grab touch-none items-center justify-center text-muted"
            >
              <GripVertical size={20} aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
