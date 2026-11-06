import { useRef, useState, type PointerEvent } from 'react';

/** Жесты со своим горизонтальным смыслом в обе стороны — строки дел, ручки перетаскивания, поля ввода. */
export const SWIPE_IGNORE = '[data-no-tab-swipe], input, textarea, select, [role="slider"]';
/** Строка со свайпом только влево («Удалить»): вправо по ней — обычный свайп вкладки. */
export const SWIPE_ROW = '[data-swipe-row]';

export interface Sample {
  t: number;
  v: number;
}

/** Скорость жеста, px/мс, по последним ~100 мс движения — а не по всему жесту: палец мог замереть и потом дёрнуть. */
export function velocityOf(samples: readonly Sample[], now: number): number {
  const lastS = samples[samples.length - 1];
  if (!lastS) return 0;
  let base = samples[0]!;
  for (const s of samples) if (now - s.t >= 100) base = s;
  const dt = lastS.t - base.t;
  return dt > 0 ? (lastS.v - base.v) / dt : 0;
}

/** Хватит ли жеста, чтобы закрыть: дальше 80 px, или дальше 30 px быстрым рывком (весь жест < 250 мс или скорость > 0,4 px/мс). */
export function shouldDismiss(distance: number, ms: number, velocity = 0): boolean {
  return distance > 80 || (distance > 30 && (ms < 250 || velocity > 0.4));
}

/**
 * «Смахнуть, чтобы закрыть»: вправо — для экранов из стека и окон, вниз — для окон (за шапку).
 * Экран едет за пальцем; отпустили далеко — уезжает и закрывается, близко — возвращается.
 * Направление решается на первых 10 px: не круче 45° — наш жест, иначе прокрутка или свайп влево — не наш.
 * События из порталов (окно поверх экрана) не считаются: React доставляет их предкам, а DOM — нет.
 */
export function useSwipeDismiss(onDismiss: () => void, { down = false }: { down?: boolean } = {}) {
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [animating, setAnimating] = useState(false);
  const g = useRef<{ x: number; y: number; t: number; mode: 'none' | 'x' | 'y' | 'off'; id: number; down: boolean; samples: Sample[] } | null>(null);
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
        g.current = {
          x: e.clientX, y: e.clientY, t: e.timeStamp, mode: 'none', id: e.pointerId, down: down && !!target.closest('[data-sheet-grab]'), samples: [{ t: e.timeStamp, v: 0 }],
        };
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        const s = g.current;
        if (!s || s.id !== e.pointerId || s.mode === 'off') return;
        const mx = e.clientX - s.x;
        const my = e.clientY - s.y;
        if (s.mode === 'none') {
          if (mx > 10 && mx > Math.abs(my)) s.mode = 'x';
          else if (s.down && my > 10 && my > Math.abs(mx)) s.mode = 'y';
          else if (mx < -10 || Math.abs(my) > 10) s.mode = 'off'; // свайп влево или прокрутка — не наш
          if (s.mode === 'x' || s.mode === 'y') e.currentTarget.setPointerCapture(e.pointerId);
        }
        if (s.mode === 'x') setOffset({ x: (last.current = Math.max(0, mx)), y: 0 });
        if (s.mode === 'y') setOffset({ x: 0, y: (last.current = Math.max(0, my)) });
        if (s.mode === 'x' || s.mode === 'y') {
          s.samples.push({ t: e.timeStamp, v: last.current });
          if (s.samples.length > 8) s.samples.shift();
        }
      },
      onPointerUp: (e: PointerEvent<HTMLElement>) => {
        const s = g.current;
        if (!s || (s.mode !== 'x' && s.mode !== 'y')) {
          g.current = null;
          return;
        }
        settle(shouldDismiss(last.current, e.timeStamp - s.t, velocityOf(s.samples, e.timeStamp)), s.mode);
      },
      onPointerCancel: () => settle(false, 'x'),
    },
  };
}
