import { useRef, useState, type PointerEvent, type ReactNode } from 'react';

const ACTION_WIDTH = 88;

/** Свайп влево открывает «Удалить»; длинный свайп удаляет сразу (SPEC 5.3). */
export function SwipeRow({
  children,
  onDelete,
  deleteLabel = 'Удалить',
}: {
  children: ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
}) {
  const [dx, setDxState] = useState(0);
  // Последнее смещение в ref: pointerup может прийти раньше перерисовки после pointermove.
  const dxRef = useRef(0);
  // Клик, который браузер шлёт после свайпа, не должен открывать запись.
  const swiped = useRef(false);
  const setDx = (v: number) => {
    dxRef.current = v;
    setDxState(v);
  };
  const [open, setOpen] = useState(false);
  const gesture = useRef<{ x: number; y: number; base: number; mode: 'none' | 'swipe' | 'scroll'; width: number } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    gesture.current = { x: e.clientX, y: e.clientY, base: open ? -ACTION_WIDTH : 0, mode: 'none', width: e.currentTarget.offsetWidth };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const mx = e.clientX - g.x;
    const my = e.clientY - g.y;
    if (g.mode === 'none') {
      if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) {
        g.mode = 'swipe';
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (Math.abs(my) > 8) g.mode = 'scroll';
    }
    if (g.mode === 'swipe') setDx(Math.min(0, g.base + mx));
  };
  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.mode !== 'swipe') return;
    swiped.current = true;
    // На тач-экране click после свайпа обычно не приходит — флаг не должен съесть следующий тап.
    setTimeout(() => (swiped.current = false), 300);
    if (-dxRef.current > g.width * 0.45) {
      setDx(0);
      setOpen(false);
      onDelete();
    } else if (-dxRef.current > ACTION_WIDTH / 2) {
      setDx(-ACTION_WIDTH);
      setOpen(true);
    } else {
      setDx(0);
      setOpen(false);
    }
  };
  const dragging = gesture.current?.mode === 'swipe';

  return (
    <div className="relative overflow-hidden">
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        onClick={() => {
          setDx(0);
          setOpen(false);
          onDelete();
        }}
        className="absolute inset-y-0 right-0 flex items-center justify-end bg-warn pr-5 font-semibold text-white"
        style={{ width: Math.max(ACTION_WIDTH, -dx) }}
      >
        {deleteLabel}
      </button>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          if (swiped.current) {
            swiped.current = false;
            e.stopPropagation();
            e.preventDefault();
            return;
          }
          if (open) {
            e.stopPropagation();
            setDx(0);
            setOpen(false);
          }
        }}
        className={`relative touch-pan-y bg-surface ${dragging ? '' : 'transition-transform duration-150'}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
      >
        {children}
      </div>
    </div>
  );
}
