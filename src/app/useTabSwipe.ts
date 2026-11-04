import { useRef, useState, type PointerEvent } from 'react';
import type { Tab } from './nav';
import { SWIPE_IGNORE } from './useSwipeDismiss';

export const TAB_ORDER: readonly Tab[] = ['today', 'money', 'tasks', 'reports'];

/** Куда перейти по свайпу: влево — следующая вкладка, вправо — предыдущая; на краях — никуда. */
export function swipeTarget(current: Tab, dx: number): Tab | null {
  const i = TAB_ORDER.indexOf(current);
  const next = dx < 0 ? i + 1 : i - 1;
  return next >= 0 && next < TAB_ORDER.length ? TAB_ORDER[next]! : null;
}


/**
 * Свайп между вкладками по любой части страницы, кроме строк со своим свайпом (SPEC 5).
 * Горизонтальный жест длиннее 64 px (или быстрый) переключает вкладку; вертикальный — обычная прокрутка.
 */
export function useTabSwipe(tab: Tab, setTab: (t: Tab) => void) {
  const [dx, setDx] = useState(0);
  /** Откуда въезжает новая вкладка после свайпа: 1 — справа, −1 — слева. */
  const [enter, setEnter] = useState<{ from: 1 | -1; key: number } | null>(null);
  const [settling, setSettling] = useState(false);
  const g = useRef<{ x: number; y: number; t: number; mode: 'none' | 'swipe' | 'scroll'; id: number } | null>(null);
  const last = useRef(0);

  const reset = (animate: boolean) => {
    g.current = null;
    last.current = 0;
    setSettling(animate);
    setDx(0);
  };

  return {
    offset: dx,
    /** Плавный возврат, если жест не дотянул до переключения. */
    settling,
    enter,
    handlers: {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const target = e.target as HTMLElement;
        // Окна — порталы: React доставляет их события сюда же, но вкладку под окном листать не надо.
        if (!e.currentTarget.contains(target) || target.closest(SWIPE_IGNORE)) return;
        g.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, mode: 'none', id: e.pointerId };
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        const s = g.current;
        if (!s || s.id !== e.pointerId) return;
        const mx = e.clientX - s.x;
        const my = e.clientY - s.y;
        if (s.mode === 'none') {
          if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.5) {
            s.mode = 'swipe';
            e.currentTarget.setPointerCapture(e.pointerId);
          } else if (Math.abs(my) > 10) s.mode = 'scroll';
        }
        if (s.mode === 'swipe') {
          // На краях — сопротивление, чтобы было видно, что дальше некуда.
          const edge = swipeTarget(tab, mx) === null;
          last.current = mx;
          setDx(edge ? mx / 4 : mx * 0.6);
        }
      },
      onPointerUp: (e: PointerEvent<HTMLElement>) => {
        const s = g.current;
        if (!s || s.mode !== 'swipe') return reset(false);
        const mx = last.current;
        const fast = Math.abs(mx) > 30 && e.timeStamp - s.t < 250;
        const target = Math.abs(mx) > 64 || fast ? swipeTarget(tab, mx) : null;
        reset(!target);
        if (target) {
          setEnter({ from: mx < 0 ? 1 : -1, key: Date.now() });
          setTab(target);
        }
      },
      onPointerCancel: () => reset(true),
    },
  };
}
