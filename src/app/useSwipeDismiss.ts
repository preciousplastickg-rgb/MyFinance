import { useRef, useState, type PointerEvent } from 'react';

/** Жесты со своим горизонтальным смыслом — строки со свайпом, ручки перетаскивания, поля ввода. */
export const SWIPE_IGNORE = '[data-no-tab-swipe], input, textarea, select, [role="slider"]';

/** Хватит ли жеста, чтобы закрыть: дальше 80 px или быстрый рывок дальше 30 px. */
export function shouldDismiss(distance: number, ms: number): boolean {
  return distance > 80 || (distance > 30 && ms < 250);
}

/**
 * «Смахнуть, чтобы закрыть»: вправо — для экранов из стека и окон, вниз — для окон (за шапку).
 * Экран едет за пальцем; отпустили далеко — уезжает и закрывается, близко — возвращается.
 * События из порталов (окно поверх экрана) не считаются: React доставляет их предкам, а DOM — нет.
 */
export function useSwipeDismiss(onDismiss: () => void, { down = false }: { down?: boolean } = {}) {
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [animating, setAnimating] = useState(false);
  const g = useRef<{ x: number; y: number; t: number; mode: 'none' | 'x' | 'y' | 'off'; id: number; down: boolean } | null>(null);
  const last = useRef(0);

  const settle = (dismiss: boolean, axis: 'x' | 'y') => {
    g.current = null;
    setAnimating(true);
    if (!dismiss) return setOffset({ x: 0, y: 0 });
    setOffset(axis === 'x' ? { x: window.innerWidth, y: 0 } : { x: 0, y: window.innerHeight });
    setTimeout(onDismiss, 160);
  };

  return {
    offset,
    style: {
      transform: offset.x || offset.y ? `translate(${offset.x}px, ${offset.y}px)` : undefined,
      transition: animating ? 'transform 160ms ease-out' : undefined,
    },
    handlers: {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (!e.currentTarget.contains(target) || target.closest(SWIPE_IGNORE)) return;
        setAnimating(false);
        last.current = 0;
        g.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, mode: 'none', id: e.pointerId, down: down && !!target.closest('[data-sheet-grab]') };
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        const s = g.current;
        if (!s || s.id !== e.pointerId || s.mode === 'off') return;
        const mx = e.clientX - s.x;
        const my = e.clientY - s.y;
        if (s.mode === 'none') {
          if (mx > 12 && mx > Math.abs(my) * 1.5) s.mode = 'x';
          else if (s.down && my > 12 && my > Math.abs(mx) * 1.5) s.mode = 'y';
          else if (Math.abs(mx) > 12 || Math.abs(my) > 10) s.mode = 'off'; // прокрутка или жест влево — не наш
          if (s.mode === 'x' || s.mode === 'y') e.currentTarget.setPointerCapture(e.pointerId);
        }
        if (s.mode === 'x') setOffset({ x: (last.current = Math.max(0, mx)), y: 0 });
        if (s.mode === 'y') setOffset({ x: 0, y: (last.current = Math.max(0, my)) });
      },
      onPointerUp: (e: PointerEvent<HTMLElement>) => {
        const s = g.current;
        if (!s || (s.mode !== 'x' && s.mode !== 'y')) {
          g.current = null;
          return;
        }
        settle(shouldDismiss(last.current, e.timeStamp - s.t), s.mode);
      },
      onPointerCancel: () => settle(false, 'x'),
    },
  };
}
