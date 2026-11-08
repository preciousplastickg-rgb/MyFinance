import { useEffect, useRef, type PointerEvent } from 'react';
import { reducedMotion } from './motion';
import { dirOf, shouldPage, SLOP, type Pager } from './useTabSwipe';

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
 * «Смахнуть, чтобы закрыть»: вправо — для экранов из стека и окон, вниз — для окон.
 * Экран едет за пальцем; отпустили далеко — уезжает и закрывается, близко — возвращается.
 * Направление решается на первых 10 px: не круче 45° — наш жест, иначе прокрутка или свайп влево — не наш.
 * Вниз закрывает из любого места окна, пока его содержимое (data-sheet-scroll) не прокручено, — как окна iOS (этап 29;
 * раньше — только за шапку). События из порталов (окно поверх экрана) не считаются: React доставляет их предкам, а DOM — нет.
 */
/** Можно ли тянуть окно вниз отсюда: шапка — всегда, остальное — пока прокручиваемое содержимое в самом верху. */
export function canPullDown(target: Element): boolean {
  if (target.closest('[data-sheet-grab]')) return true;
  const scroller = target.closest('[data-sheet-scroll]');
  return !scroller || scroller.scrollTop <= 0;
}

/**
 * Забрать ли касание под «тянуть вниз» на первом touchmove (iPhone). У прокручиваемого содержимого touch-action: pan-y,
 * и Safari сам начинает прокрутку (с отскоком у верхнего края) и шлёт pointercancel — окно не закрывалось.
 * Палец пошёл вниз (не круче 45°) у верхнего края — preventDefault, прокрутки не будет, жест достаётся окну.
 */
export function claimPullDown(dx: number, dy: number): boolean {
  return dy > 0 && dy >= Math.abs(dx);
}

/** Длительность «уехать и закрыться» и «вернуться на место», мс; кривая — как у окон iOS. */
export const DISMISS_MS = 260;
export const RETURN_MS = 320;
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

/** Сколько окно уже «уехало», 0–1: фон под окном светлеет вместе с ним. */
export function dismissProgress(x: number, y: number, width: number, height: number): number {
  return Math.min(1, Math.max(x / width, y / (height * 0.6)));
}

/**
 * Стиль окна и фона под ним. Пишется прямо в DOM, без React: раньше смещение было состоянием, и «Новая запись» с клавиатурой
 * и категориями перерисовывалась целиком на каждое движение пальца. phase: drag — за пальцем, в своём слое (will-change);
 * back — возвращается на место; away — уезжает и закрывается, фон гаснет; rest — на месте, без слоя.
 */
export function dismissStyles(x: number, y: number, phase: 'drag' | 'back' | 'away' | 'rest', width: number, height: number) {
  const ms = phase === 'away' ? DISMISS_MS : phase === 'back' ? RETURN_MS : 0;
  const moved = phase === 'drag' || phase === 'away';
  return {
    sheet: {
      transform: moved && (x || y) ? `translate3d(${x}px, ${y}px, 0)` : '',
      transition: ms ? `transform ${ms}ms ${EASE}` : '',
      willChange: phase === 'rest' ? '' : 'transform',
    },
    backdrop: {
      opacity: phase === 'away' ? '0' : phase === 'drag' ? String(1 - dismissProgress(x, y, width, height) * 0.85) : '',
      transition: phase === 'away' ? `opacity ${DISMISS_MS}ms ease-out` : phase === 'back' ? `opacity ${RETURN_MS}ms ${EASE}` : '',
    },
  };
}

/**
 * pager (этап 28): горизонтальный свайп сначала листает ряд внутри окна (типы записи «Расход / Доход / Перевод»),
 * и только с его края — вправо — закрывает окно. Влево на краю ряда — ничего.
 */
export function useSwipeDismiss(onDismiss: () => void, { down = false, pager }: { down?: boolean; pager?: Pager } = {}) {
  const g = useRef<{ x: number; y: number; t: number; mode: 'none' | 'x' | 'y' | 'page' | 'off'; id: number; down: boolean; samples: Sample[] } | null>(null);
  const last = useRef(0);
  const node = useRef<HTMLDivElement | null>(null);
  const backdrop = useRef<HTMLDivElement | null>(null);
  const touch0 = useRef<{ x: number; y: number } | null>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const closed = useRef(false);
  /** Окно возвращается на место: по таймеру снять переход и слой. */
  const rest = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const put = (x: number, y: number, phase: 'drag' | 'back' | 'away' | 'rest') => {
    const st = dismissStyles(x, y, phase, window.innerWidth, window.innerHeight);
    if (node.current) Object.assign(node.current.style, st.sheet);
    if (backdrop.current) Object.assign(backdrop.current.style, st.backdrop);
  };
  const stopReturn = () => {
    if (rest.current === undefined) return;
    clearTimeout(rest.current);
    rest.current = undefined;
    put(0, 0, 'rest');
  };

  const settle = (dismiss: boolean, axis: 'x' | 'y') => {
    g.current = null;
    if (!dismiss) {
      put(0, 0, 'back');
      rest.current = setTimeout(stopReturn, reducedMotion() ? 0 : RETURN_MS);
      return;
    }
    if (closed.current) return;
    closed.current = true;
    if (axis === 'x') put(window.innerWidth, 0, 'away');
    else put(0, window.innerHeight, 'away');
    setTimeout(() => dismissRef.current(), reducedMotion() ? 0 : DISMISS_MS);
  };

  useEffect(() => () => clearTimeout(rest.current), []);

  // iPhone: тянуть вниз из прокручиваемого содержимого — свой обработчик touchmove (не пассивный), см. claimPullDown.
  useEffect(() => {
    const el = node.current;
    if (!el || !down) return;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touch0.current = t && e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
    };
    const onMove = (e: TouchEvent) => {
      const s = g.current;
      const t0 = touch0.current;
      const t = e.touches[0];
      if (!s || !t0 || !t || !e.cancelable) return;
      if (s.mode === 'y') return e.preventDefault();
      if (s.mode === 'none' && s.down && claimPullDown(t.clientX - t0.x, t.clientY - t0.y)) e.preventDefault();
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
    };
  }, [down]);

  return {
    /** Вешается на то, что едет: само окно (на нём же слушается touchmove для «тянуть вниз» на iPhone) или экран из стека. */
    ref: node,
    /** Фон под окном — светлеет, пока окно тянут, и гаснет, когда оно уезжает. */
    backdropRef: backdrop,
    handlers: {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (closed.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
        const target = e.target as HTMLElement;
        if (!e.currentTarget.contains(target) || target.closest(SWIPE_IGNORE)) return;
        // Мышь: без выделения текста при перетаскивании окна (см. useTabSwipe).
        if (e.pointerType === 'mouse') e.preventDefault();
        stopReturn();
        last.current = 0;
        g.current = {
          x: e.clientX, y: e.clientY, t: e.timeStamp, mode: 'none', id: e.pointerId, down: down && canPullDown(target), samples: [{ t: e.timeStamp, v: 0 }],
        };
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        const s = g.current;
        if (!s || s.id !== e.pointerId || s.mode === 'off') return;
        const mx = e.clientX - s.x;
        const my = e.clientY - s.y;
        if (s.mode === 'none') {
          const horizontal = Math.abs(mx) > SLOP && Math.abs(mx) > Math.abs(my);
          if (horizontal && pager?.canGo(dirOf(mx))) s.mode = 'page';
          else if (mx > SLOP && mx > Math.abs(my)) s.mode = 'x';
          else if (s.down && my > SLOP && my > Math.abs(mx)) s.mode = 'y';
          else if (mx < -SLOP || Math.abs(my) > SLOP) s.mode = 'off'; // свайп влево или прокрутка — не наш
          if (s.mode === 'x' || s.mode === 'y') e.currentTarget.setPointerCapture(e.pointerId);
        }
        // Окно трогается с места без рывка: первые SLOP px ушли на то, чтобы понять направление (как у вкладок).
        if (s.mode === 'x') put((last.current = Math.max(0, mx - SLOP)), 0, 'drag');
        if (s.mode === 'y') put(0, (last.current = Math.max(0, my - SLOP)), 'drag');
        if (s.mode === 'page') last.current = mx;
        if (s.mode === 'x' || s.mode === 'y' || s.mode === 'page') {
          s.samples.push({ t: e.timeStamp, v: last.current });
          if (s.samples.length > 8) s.samples.shift();
        }
      },
      onPointerUp: (e: PointerEvent<HTMLElement>) => {
        const s = g.current;
        if (s?.mode === 'page') {
          const mx = last.current;
          g.current = null;
          if (shouldPage(mx, velocityOf(s.samples, e.timeStamp))) pager?.go(dirOf(mx));
          return;
        }
        if (!s || (s.mode !== 'x' && s.mode !== 'y')) {
          g.current = null;
          return;
        }
        settle(shouldDismiss(last.current, e.timeStamp - s.t, velocityOf(s.samples, e.timeStamp)), s.mode);
      },
      onPointerCancel: () => {
        if (g.current?.mode === 'x' || g.current?.mode === 'y') settle(false, 'x');
        else g.current = null;
      },
    },
  };
}
