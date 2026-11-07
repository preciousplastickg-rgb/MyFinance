import { useRef, useState, type PointerEvent } from 'react';
import type { Tab } from './nav';
import { SWIPE_IGNORE, SWIPE_ROW, velocityOf, type Sample } from './useSwipeDismiss';

export const TAB_ORDER: readonly Tab[] = ['today', 'money', 'tasks', 'goals', 'reports'];
/** При «+» по центру (этап 26) «Цели» живут в «Делах»: в меню и в свайпе четыре вкладки. */
export const TAB_ORDER_CENTER: readonly Tab[] = ['today', 'money', 'tasks', 'reports'];

/** Направление листания: свайп влево — вперёд (+1), вправо — назад (−1). */
export type PageDir = 1 | -1;
export const dirOf = (dx: number): PageDir => (dx < 0 ? 1 : -1);

/** Что листает свайп: можно ли шагнуть в сторону и сам шаг. */
export interface Pager {
  canGo: (dir: PageDir) => boolean;
  go: (dir: PageDir) => void;
}

/** Листание по списку значений: вкладки меню, разделы «Дел» и «Отчётов», тип записи. */
export function listPager<T>(items: readonly T[], current: T, set: (v: T) => void): Pager {
  const i = items.indexOf(current);
  const at = (dir: PageDir) => (i < 0 ? undefined : items[i + dir]);
  return {
    canGo: (dir) => at(dir) !== undefined,
    go: (dir) => {
      const v = at(dir);
      if (v !== undefined) set(v);
    },
  };
}

/**
 * Вложенное листание (этап 28): разделы «Задачи / Привычки / Цели» и «Деньги / Дела / Привычки» листаются коротким
 * свайпом (как вкладки раньше), а вкладки меню из этих экранов — широким: дальше wideThreshold (45 % ширины экрана).
 * Пока палец в пределах порога, едет только панель раздела; дальше — вся страница. Если раздел в эту сторону
 * листать некуда, жест сразу листает вкладку по обычному правилу.
 */
export function wideThreshold(width = window.innerWidth): number {
  return Math.round(width * 0.45);
}

/** Куда перейти по свайпу: влево — следующая вкладка, вправо — предыдущая; на краях — никуда. Порядок — видимые вкладки. */
export function swipeTarget(current: Tab, dx: number, order: readonly Tab[] = TAB_ORDER): Tab | null {
  const i = order.indexOf(current);
  if (i < 0) return null;
  const next = dx < 0 ? i + 1 : i - 1;
  return next >= 0 && next < order.length ? order[next]! : null;
}

/** Жест — горизонтальный: дальше 10 px и не круче 45° (раньше требовалось 34°, и свайп по дуге большим пальцем терялся). */
export function isHorizontal(mx: number, my: number): boolean {
  return Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my);
}

/** Хватит ли жеста на переключение: дальше 64 px или рывок дальше 30 px быстрее 0,4 px/мс в ту же сторону. */
export function shouldPage(mx: number, vx: number): boolean {
  const fast = Math.abs(mx) > 30 && Math.abs(vx) > 0.4 && Math.sign(vx) === Math.sign(mx);
  return Math.abs(mx) > 64 || fast;
}

export function tabSwipeTarget(current: Tab, mx: number, vx: number, order: readonly Tab[] = TAB_ORDER): Tab | null {
  return shouldPage(mx, vx) ? swipeTarget(current, mx, order) : null;
}

/**
 * Свайп между вкладками по любой части страницы (SPEC 5). Строки со своим свайпом: дело — целиком своё (обе стороны),
 * запись в истории — влево «Удалить», вправо — предыдущая вкладка. Вертикальный жест — обычная прокрутка.
 */
export interface SwipeEnter {
  from: PageDir;
  key: number;
}

export function useTabSwipe(outer: Pager, inner: Pager | null = null) {
  const [dx, setDx] = useState(0);
  const [innerDx, setInnerDx] = useState(0);
  /** Откуда въезжает новая вкладка (или панель раздела) после свайпа: 1 — справа, −1 — слева. */
  const [enter, setEnter] = useState<SwipeEnter | null>(null);
  const [innerEnter, setInnerEnter] = useState<SwipeEnter | null>(null);
  const [settling, setSettling] = useState(false);
  const g = useRef<{ x: number; y: number; mode: 'none' | 'swipe' | 'scroll'; id: number; row: boolean; samples: Sample[] } | null>(null);
  const last = useRef(0);

  const reset = (animate: boolean) => {
    g.current = null;
    last.current = 0;
    setSettling(animate);
    setDx(0);
    setInnerDx(0);
  };

  return {
    offset: dx,
    /** Смещение панели раздела внутри экрана (короткий свайп). */
    innerOffset: innerDx,
    /** Плавный возврат, если жест не дотянул до переключения. */
    settling,
    enter,
    innerEnter,
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
          const dir = dirOf(mx);
          last.current = mx;
          s.samples.push({ t: e.timeStamp, v: mx });
          if (s.samples.length > 8) s.samples.shift();
          const outerDrag = (v: number) => (outer.canGo(dir) ? v * 0.6 : v / 4); // на краю — сопротивление
          if (inner?.canGo(dir)) {
            const t = wideThreshold();
            const sign = Math.sign(mx);
            setInnerDx(sign * Math.min(Math.abs(mx), t) * 0.6);
            setDx(Math.abs(mx) > t ? outerDrag(mx - sign * t) : 0);
          } else {
            setInnerDx(0);
            setDx(outerDrag(mx));
          }
        }
      },
      onPointerUp: (e: PointerEvent<HTMLElement>) => {
        const s = g.current;
        if (!s || s.mode !== 'swipe') return reset(false);
        const mx = last.current;
        const dir = dirOf(mx);
        const vx = velocityOf(s.samples, e.timeStamp);
        const innerActive = !!inner?.canGo(dir);
        if (innerActive && Math.abs(mx) > wideThreshold() && outer.canGo(dir)) {
          reset(false);
          setEnter({ from: dir, key: Date.now() });
          outer.go(dir);
        } else if (innerActive && shouldPage(mx, vx)) {
          reset(false);
          setInnerEnter({ from: dir, key: Date.now() });
          inner!.go(dir);
        } else if (!innerActive && shouldPage(mx, vx) && outer.canGo(dir)) {
          reset(false);
          setEnter({ from: dir, key: Date.now() });
          outer.go(dir);
        } else reset(true);
      },
      onPointerCancel: () => reset(true),
    },
  };
}
