import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { reducedMotion } from './motion';
import { dirOf, shouldPage, type Pager } from './useTabSwipe';

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
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

/**
 * pager (этап 28): горизонтальный свайп сначала листает ряд внутри окна (типы записи «Расход / Доход / Перевод»),
 * и только с его края — вправо — закрывает окно. Влево на краю ряда — ничего.
 * dismiss() — закрыть с той же анимацией из кода: крестик, фон, «Отмена», «‹ Назад».
 */
export function useSwipeDismiss(onDismiss: () => void, { down = false, pager }: { down?: boolean; pager?: Pager } = {}) {
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [animating, setAnimating] = useState(false);
  const [closing, setClosing] = useState(false);
  const g = useRef<{ x: number; y: number; t: number; mode: 'none' | 'x' | 'y' | 'page' | 'off'; id: number; down: boolean; samples: Sample[] } | null>(null);
  const last = useRef(0);
  const node = useRef<HTMLDivElement | null>(null);
  const touch0 = useRef<{ x: number; y: number } | null>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const closed = useRef(false);

  const settle = (dismiss: boolean, axis: 'x' | 'y') => {
    g.current = null;
    setAnimating(true);
    if (!dismiss) return setOffset({ x: 0, y: 0 });
    if (closed.current) return;
    closed.current = true;
    setClosing(true);
    setOffset(axis === 'x' ? { x: window.innerWidth, y: 0 } : { x: 0, y: window.innerHeight });
    setTimeout(() => dismissRef.current(), reducedMotion() ? 0 : DISMISS_MS);
  };

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

  const width = typeof window === 'undefined' ? 1 : window.innerWidth;
  const height = typeof window === 'undefined' ? 1 : window.innerHeight;
  return {
    offset,
    /** Сколько окно уже «уехало», 0–1: фон под окном светлеет вместе с ним. */
    progress: Math.min(1, Math.max(offset.x / width, offset.y / (height * 0.6))),
    /** Окно закрывается — фон гаснет, повторные нажатия не нужны. */
    closing,
    /** Вешается на само окно: на нём слушается touchmove для «тянуть вниз» на iPhone. */
    ref: node,
    dismiss: (axis: 'x' | 'y' = 'y') => settle(true, axis),
    style: {
      transform: offset.x || offset.y ? `translate(${offset.x}px, ${offset.y}px)` : undefined,
      transition: animating ? `transform ${closing ? DISMISS_MS : 320}ms ${EASE}` : undefined,
    },
    handlers: {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (closed.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
        const target = e.target as HTMLElement;
        if (!e.currentTarget.contains(target) || target.closest(SWIPE_IGNORE)) return;
        // Мышь: без выделения текста при перетаскивании окна (см. useTabSwipe).
        if (e.pointerType === 'mouse') e.preventDefault();
        setAnimating(false);
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
          const horizontal = Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my);
          if (horizontal && pager?.canGo(dirOf(mx))) s.mode = 'page';
          else if (mx > 10 && mx > Math.abs(my)) s.mode = 'x';
          else if (s.down && my > 10 && my > Math.abs(mx)) s.mode = 'y';
          else if (mx < -10 || Math.abs(my) > 10) s.mode = 'off'; // свайп влево или прокрутка — не наш
          if (s.mode === 'x' || s.mode === 'y') e.currentTarget.setPointerCapture(e.pointerId);
        }
        if (s.mode === 'x') setOffset({ x: (last.current = Math.max(0, mx)), y: 0 });
        if (s.mode === 'y') setOffset({ x: 0, y: (last.current = Math.max(0, my)) });
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
