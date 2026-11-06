import { useRef, useState, type PointerEvent } from 'react';
import type { Tab } from './nav';
import { SWIPE_IGNORE, SWIPE_ROW, velocityOf, type Sample } from './useSwipeDismiss';

export const TAB_ORDER: readonly Tab[] = ['today', 'money', 'tasks', 'goals', 'reports'];

/** Куда перейти по свайпу: влево — следующая вкладка, вправо — предыдущая; на краях — никуда. */
export function swipeTarget(current: Tab, dx: number): Tab | null {
  const i = TAB_ORDER.indexOf(current);
  const next = dx < 0 ? i + 1 : i - 1;
  return next >= 0 && next < TAB_ORDER.length ? TAB_ORDER[next]! : null;
}

/** Жест — горизонтальный: дальше 10 px и не круче 45° (раньше требовалось 34°, и свайп по дуге большим пальцем терялся). */
export function isHorizontal(mx: number, my: number): boolean {
  return Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my);
}

/** Хватит ли жеста на переключение: дальше 64 px или рывок дальше 30 px быстрее 0,4 px/мс в ту же сторону. */
export function tabSwipeTarget(current: Tab, mx: number, vx: number): Tab | null {
  const fast = Math.abs(mx) > 30 && Math.abs(vx) > 0.4 && Math.sign(vx) === Math.sign(mx);
  return Math.abs(mx) > 64 || fast ? swipeTarget(current, mx) : null;
}

/**
 * Свайп между вкладками по любой части страницы (SPEC 5). Строки со своим свайпом: дело — целиком своё (обе стороны),
 * запись в истории — влево «Удалить», вправо — предыдущая вкладка. Вертикальный жест — обычная прокрутка.
 */
export function useTabSwipe(tab: Tab, setTab: (t: Tab) => void) {
  const [dx, setDx] = useState(0);
  /** Откуда въезжает новая вкладка после свайпа: 1 — справа, −1 — слева. */
  const [enter, setEnter] = useState<{ from: 1 | -1; key: number } | null>(null);
  const [settling, setSettling] = useState(false);
  const g = useRef<{ x: number; y: number; mode: 'none' | 'swipe' | 'scroll'; id: number; row: boolean; samples: Sample[] } | null>(null);
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
        g.current = { x: e.clientX, y: e.clientY, mode: 'none', id: e.pointerId, row: !!target.closest(SWIPE_ROW), samples: [{ t: e.timeStamp, v: 0 }] };
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        const s = g.current;
        if (!s || s.id !== e.pointerId) return;
        const mx = e.clientX - s.x;
        const my = e.clientY - s.y;
        if (s.mode === 'none') {
          if (isHorizontal(mx, my)) {
            // Влево по строке истории — её «Удалить», а не вкладка.
            if (s.row && mx < 0) return void (s.mode = 'scroll');
            s.mode = 'swipe';
            e.currentTarget.setPointerCapture(e.pointerId);
          } else if (Math.abs(my) > 10) s.mode = 'scroll';
        }
        if (s.mode === 'swipe') {
          // На краях — сопротивление, чтобы было видно, что дальше некуда.
          const edge = swipeTarget(tab, mx) === null;
          last.current = mx;
          s.samples.push({ t: e.timeStamp, v: mx });
          if (s.samples.length > 8) s.samples.shift();
          setDx(edge ? mx / 4 : mx * 0.6);
        }
      },
      onPointerUp: (e: PointerEvent<HTMLElement>) => {
        const s = g.current;
        if (!s || s.mode !== 'swipe') return reset(false);
        const mx = last.current;
        const target = tabSwipeTarget(tab, mx, velocityOf(s.samples, e.timeStamp));
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
