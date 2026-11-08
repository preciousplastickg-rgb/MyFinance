import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { flushSync } from 'react-dom';
import {
  caughtOffset,
  EASE_IOS,
  EDGE_RETURN_MS,
  isHorizontal,
  laneNeighbors,
  laneOffset,
  laneRaw,
  laneStep,
  settleCurve,
  settleDuration,
  SLOP,
  slopped,
  VELOCITY_MS,
  type PageDir,
  type PageKey,
} from './lane';
import { createLaneBus, REST } from './laneContext';
import { reducedMotion } from './motion';
import { SWIPE_IGNORE, SWIPE_ROW, velocityOf, type Sample } from './useSwipeDismiss';

export { dirOf, SLOP, type PageDir } from './lane';

/** Что листает свайп в окне: можно ли шагнуть в сторону и сам шаг (тип «Расход / Доход / Перевод» в «Новой записи»). */
export interface Pager {
  canGo: (dir: PageDir) => boolean;
  go: (dir: PageDir) => void;
}

/** Листание по списку значений. */
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

/** Окна (SPEC 5.2, не лента): хватит ли жеста — дальше 64 px или рывок дальше 30 px быстрее 0,4 px/мс в ту же сторону. */
export function shouldPage(mx: number, vx: number): boolean {
  const fast = Math.abs(mx) > 30 && Math.abs(vx) > 0.4 && Math.sign(vx) === Math.sign(mx);
  return Math.abs(mx) > 64 || fast;
}

interface Gesture {
  x: number;
  y: number;
  id: number;
  mode: 'none' | 'swipe' | 'scroll';
  /** Строка истории: влево — её «Удалить», вправо — лента. */
  row: boolean;
  /** Где был «палец» в начале жеста (≠ 0, если страницу поймали во время доезда). */
  base: number;
  caught: boolean;
  /** Где «палец» относительно ленты: base + смещение пальца. Из него — резинка, решение и скорость. */
  raw: number;
  samples: Sample[];
  /** К какому соседу уже попросили (onGrab): при смене направления — попросить второго. */
  asked: PageDir | 0;
}

/**
 * Лента (этап 31, SPEC 9b): все экраны — один ряд страниц, любой свайп — ровно одна страница. Лента — один контейнер,
 * его transform пишется через ref в requestAnimationFrame, без setState на каждое движение; will-change — только на время
 * жеста. Решение при отпускании — по проекции и рывку, доезд — со скоростью пальца, на краях — резинка. Касание во время
 * доезда ловит страницу с текущего места. Меню (пилюля, панель разделов) получает каждый кадр через шину bus.
 *
 * Строки со своим свайпом: дело — целиком своё, запись в истории — влево «Удалить», вправо — лента. Вертикальный жест —
 * прокрутка; после захвата горизонтали прокрутка блокируется до конца жеста.
 */
export function useLaneSwipe(options: {
  order: readonly PageKey[];
  current: PageKey;
  go: (key: PageKey) => void;
  /** Страница поехала к соседу dir (+1 — следующий): смонтировать его, если ещё нет. */
  onGrab?: (dir: PageDir) => void;
}) {
  const root = useRef<HTMLElement | null>(null);
  const lane = useRef<HTMLDivElement | null>(null);
  const [bus] = useState(createLaneBus);
  const props = useRef(options);
  props.current = options;
  const g = useRef<Gesture | null>(null);
  const offset = useRef(0);
  /** Ширина — единственное чтение раскладки, в начале жеста. */
  const width = useRef(1);
  const raf = useRef(0);
  /** Идёт доезд: к чему, что сделать в конце и с какой страницы он начался. */
  const settling = useRef<{ timer: ReturnType<typeof setTimeout>; target: number; from: PageKey; commit?: () => void } | null>(null);

  const paint = () => {
    raf.current = 0;
    if (lane.current) lane.current.style.transform = `translate3d(${offset.current}px, 0, 0)`;
    bus.set({ progress: -offset.current / width.current, ms: 0, curve: '' });
  };
  const move = (x: number) => {
    offset.current = x;
    if (!raf.current) raf.current = requestAnimationFrame(paint);
  };
  const cancelFrame = () => {
    if (!raf.current) return;
    cancelAnimationFrame(raf.current);
    raf.current = 0;
  };

  /** Конец доезда: переключить страницу и в том же кадре вернуть ленту на 0, без перехода и без отдельного слоя. */
  const finish = (from: PageKey, commit?: () => void) => {
    settling.current = null;
    cancelFrame();
    offset.current = 0;
    bus.set(REST);
    // Пока ехали, страницу могли сменить тапом по меню — тогда старый переход не применяется.
    if (commit && props.current.current === from) flushSync(commit);
    const s = lane.current?.style;
    if (s) {
      s.transition = '';
      s.transform = '';
      s.willChange = '';
    }
  };

  const settle = (target: number, ms: number, curve: string, commit?: () => void) => {
    cancelFrame();
    const from = props.current.current;
    if (ms <= 0) return finish(from, commit);
    const s = lane.current?.style;
    if (s) {
      s.transition = `transform ${ms}ms ${curve}`;
      s.transform = `translate3d(${target}px, 0, 0)`;
    }
    offset.current = target;
    bus.set({ progress: -target / width.current, ms, curve });
    settling.current = { timer: setTimeout(() => finish(from, commit), ms), target, from, commit };
  };

  /** Палец отпущен (или жест отменён системой): куда и как доехать. v — скорость пальца, px/мс. */
  const release = (v: number, cancelled: boolean) => {
    const s = g.current;
    g.current = null;
    if (!s) return;
    const W = width.current;
    const { order, current, go } = props.current;
    const n = laneNeighbors(order, current);
    const step = cancelled ? 0 : laneStep(s.raw, v, W);
    const to = step === 1 ? n.next : step === -1 ? n.prev : undefined;
    const at = offset.current;
    const off = reducedMotion();
    if (to && step) {
      const target = -step * W;
      const ms = off ? 0 : settleDuration(target - at, v);
      return settle(target, ms, settleCurve(target - at, v * Math.sign(target - at), ms), () => go(to));
    }
    // Назад: с резинки — 300 мс кривой iOS, иначе — по скорости пальца.
    const edge = cancelled || (at > 0 && !n.prev) || (at < 0 && !n.next);
    const ms = off || Math.abs(at) < 0.5 ? 0 : edge ? EDGE_RETURN_MS : settleDuration(-at, v);
    settle(0, ms, edge ? EASE_IOS : settleCurve(-at, v * Math.sign(-at), ms));
  };

  // Блок вертикальной прокрутки после захвата: Safari мог начать прокрутку посреди горизонтального жеста и прислать
  // pointercancel. touchmove не пассивный — preventDefault работает; до захвата прокрутка не трогается. Ref-колбэк, а не
  // эффект: <main> появляется не сразу (сначала — первый запуск).
  const rootRef = useCallback((el: HTMLElement | null) => {
    root.current?.removeEventListener('touchmove', blockScroll);
    root.current = el;
    el?.addEventListener('touchmove', blockScroll, { passive: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function blockScroll(e: TouchEvent) {
    if (g.current?.mode === 'swipe' && e.cancelable) e.preventDefault();
  }
  useEffect(
    () => () => {
      cancelFrame();
      if (settling.current) clearTimeout(settling.current.timer);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return {
    /** На неподвижную <main>: жест ловится на ней. */
    rootRef,
    /** На контейнер ленты: его transform двигает все страницы разом. */
    laneRef: lane,
    bus,
    handlers: {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const target = e.target as HTMLElement;
        // Окна — порталы: React доставляет их события сюда же, но ленту под окном листать не надо.
        if (!e.currentTarget.contains(target) || target.closest(SWIPE_IGNORE)) return;
        // Мышь (Safari на Mac, тесты): без этого жест у нижнего края начинал выделение текста, и WebKit переставал
        // отдавать события указателя. Клик это не отменяет; касания не трогаем.
        if (e.pointerType === 'mouse') e.preventDefault();
        const pending = settling.current;
        const el = lane.current;
        if (pending && el) {
          // Касание во время доезда ловит страницу с текущего места; за половиной пути переход уже засчитан.
          clearTimeout(pending.timer);
          settling.current = null;
          const t = getComputedStyle(el).transform;
          const tx = t && t !== 'none' ? new DOMMatrixReadOnly(t).m41 : 0;
          const c = caughtOffset(tx, pending.target, width.current);
          el.style.transition = '';
          if (c.commit && pending.commit && props.current.current === pending.from) flushSync(pending.commit);
          offset.current = c.offset;
          paint();
          const n = laneNeighbors(props.current.order, props.current.current);
          const raw = laneRaw(c.offset, width.current, !!n.prev, !!n.next);
          g.current = { x: e.clientX, y: e.clientY, id: e.pointerId, mode: 'swipe', row: false, base: raw, caught: true, raw, samples: [{ t: e.timeStamp, v: raw }], asked: 0 };
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }
        width.current = window.innerWidth;
        g.current = {
          x: e.clientX, y: e.clientY, id: e.pointerId, mode: 'none', row: !!target.closest(SWIPE_ROW), base: 0, caught: false, raw: 0, samples: [{ t: e.timeStamp, v: 0 }], asked: 0,
        };
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        const s = g.current;
        if (!s || s.id !== e.pointerId) return;
        const mx = e.clientX - s.x;
        const my = e.clientY - s.y;
        if (s.mode === 'none') {
          if (isHorizontal(mx, my)) {
            // Влево по строке истории — её «Удалить», а не лента.
            if (s.row && mx < 0) return void (s.mode = 'scroll');
            s.mode = 'swipe';
            e.currentTarget.setPointerCapture(e.pointerId);
            if (lane.current) lane.current.style.willChange = 'transform';
          } else if (Math.abs(my) > SLOP) s.mode = 'scroll'; // начавшаяся прокрутка горизонталь уже не захватывает
        }
        if (s.mode !== 'swipe') return;
        s.raw = s.base + (s.caught ? mx : slopped(mx));
        const toward: PageDir | 0 = s.raw < 0 ? 1 : s.raw > 0 ? -1 : 0;
        if (toward && toward !== s.asked) {
          s.asked = toward;
          props.current.onGrab?.(toward);
        }
        s.samples.push({ t: e.timeStamp, v: s.raw });
        if (s.samples.length > 24) s.samples.shift();
        const n = laneNeighbors(props.current.order, props.current.current);
        move(laneOffset(s.raw, width.current, !!n.prev, !!n.next));
      },
      onPointerUp: (e: PointerEvent<HTMLElement>) => {
        const s = g.current;
        if (!s || s.mode !== 'swipe') {
          g.current = null;
          return;
        }
        release(velocityOf(s.samples, e.timeStamp, VELOCITY_MS), false);
      },
      onPointerCancel: () => {
        if (g.current?.mode === 'swipe') release(0, true);
        else g.current = null;
      },
    },
  };
}
