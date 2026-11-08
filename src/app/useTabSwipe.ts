import { startTransition, useRef, useState, type PointerEvent } from 'react';
import { flushSync } from 'react-dom';
import { reducedMotion } from './motion';
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

/** Сколько пальцу пройти, прежде чем жест решится, px. */
export const SLOP = 10;

/**
 * Смещение страницы за пальцем без первых SLOP px: жест решается на 10 px, и страница раньше прыгала на них сразу —
 * в начале свайпа был заметный рывок. Теперь она трогается с нуля, как прокрутка iOS.
 */
export function slopped(mx: number): number {
  return mx > SLOP ? mx - SLOP : mx < -SLOP ? mx + SLOP : 0;
}

/** Хватит ли жеста на переключение: дальше 64 px или рывок дальше 30 px быстрее 0,4 px/мс в ту же сторону. */
export function shouldPage(mx: number, vx: number): boolean {
  const fast = Math.abs(mx) > 30 && Math.abs(vx) > 0.4 && Math.sign(vx) === Math.sign(mx);
  return Math.abs(mx) > 64 || fast;
}

export function tabSwipeTarget(current: Tab, mx: number, vx: number, order: readonly Tab[] = TAB_ORDER): Tab | null {
  return shouldPage(mx, vx) ? swipeTarget(current, mx, order) : null;
}

/** Шапка вкладки: свайп отсюда всегда листает вкладки, а не разделы — понятная зона для «большого» жеста. */
export const SWIPE_TAB_ZONE = '[data-tab-swipe]';

/** Сколько длится «доезд» страницы или панели после отпускания пальца, мс (кривая iOS --ease-ios из index.css, см. slotStyle). */
export const SETTLE_MS = 300;

/**
 * Через сколько мс после начала жеста рисовать соседнюю вкладку. Быстрый взмах обходится без неё: соседняя монтируется
 * в момент отпускания и доезжает с места пальца. Иначе тяжёлый первый показ («Отчёты») занимал поток посреди жеста,
 * и WebKit под нагрузкой терял pointerup — жест «залипал».
 */
export const NEIGHBOR_DELAY_MS = 120;

/**
 * Какие соседи смонтированы при листании (этап 29). Меняется несколько раз за жест — когда соседей пора показать, жест сменил
 * направление, перешёл порог широкого свайпа, закончился. Само движение React не перерисовывает: см. Motion.
 */
export interface PagerView {
  /** Соседняя вкладка, которая едет рядом со страницей: 1 — справа (следующая), −1 — слева, 0 — нет. */
  outer: PageDir | 0;
  /** Соседний раздел («Привычки» рядом с «Задачами»). */
  inner: PageDir | 0;
}

export const IDLE_VIEW: PagerView = { outer: 0, inner: 0 };

/**
 * Где страницы и панели прямо сейчас. useTabSwipe пишет это прямо в style слотов (PagerSlot) — без React и без CSS-переменных:
 * раньше сдвиг жил в наследуемых --tab-dx/--pane-dx на <main>, и каждое движение пальца пересчитывало стили всей вкладки.
 */
export interface Motion {
  tab: number;
  pane: number;
  /** Идёт жест или доезд: слоты сдвинуты и вынесены в свои слои (will-change), чтобы iPhone не перерисовывал экран каждый кадр. */
  live: boolean;
  /** Палец отпущен — всё доезжает до места. */
  settling: boolean;
  /** Широкий свайп перешёл порог: панели разделов плавно возвращаются на место, дальше едет страница. */
  snap: boolean;
}

export const IDLE_MOTION: Motion = { tab: 0, pane: 0, live: false, settling: false, snap: false };

/** Что двигает свайп: страница вкладки или панель раздела. side — где слот: 0 — текущий, 1 — сосед справа, −1 — слева. */
export type SlotKind = 'tab' | 'pane';

export function slotStyle(kind: SlotKind, side: PageDir | 0, m: Motion): { transform: string; transition: string; willChange: string } {
  const x = kind === 'tab' ? m.tab : m.pane;
  const glide = m.live && (m.settling || (kind === 'pane' && m.snap));
  return {
    // Вне жеста — translateX(0px), как было: текущая страница остаётся контейнером для своих fixed и z-index.
    transform: side ? `translate3d(calc(${x}px ${side > 0 ? '+' : '-'} 100%), 0, 0)` : m.live ? `translate3d(${x}px, 0, 0)` : 'translateX(0px)',
    transition: glide ? `transform ${SETTLE_MS}ms var(--ease-ios)` : '',
    willChange: m.live ? 'transform' : '',
  };
}

/** Слоты, которые двигает свайп: PagerSlot сообщает о себе при монтировании и при смене side. */
export interface PagerSlots {
  /** Слот смонтирован: поставить на место и двигать вместе со всеми; возвращает «забыть». */
  attach: (el: HTMLElement) => () => void;
  /** Слот перерисован — мог смениться side. */
  place: (el: HTMLElement) => void;
}

export const NO_SLOTS: PagerSlots = { attach: () => () => {}, place: () => {} };

export interface DragInput {
  outer: Pager;
  inner: Pager | null;
  /** Жест начат на шапке экрана — только вкладки. */
  tabOnly: boolean;
  width: number;
}

/**
 * Где страница и панель при смещении пальца mx. До порога широкого свайпа едет только панель раздела (1:1), за порогом —
 * вся страница; если раздел в эту сторону листать некуда — сразу страница. На краю меню — сопротивление (¼ хода).
 */
export function dragOffsets(mx: number, { outer, inner, tabOnly, width }: DragInput): { tab: number; pane: number; outer: PageDir | 0; inner: PageDir | 0; snap: boolean } {
  const dir = dirOf(mx);
  const outerCan = outer.canGo(dir);
  const pageDrag = (v: number) => (outerCan ? v : v / 4);
  if (!tabOnly && inner?.canGo(dir)) {
    const t = wideThreshold(width);
    if (Math.abs(mx) > t) return { tab: pageDrag(mx - Math.sign(mx) * t), pane: 0, outer: outerCan ? dir : 0, inner: dir, snap: true };
    return { tab: 0, pane: mx, outer: 0, inner: dir, snap: false };
  }
  return { tab: pageDrag(mx), pane: 0, outer: outerCan ? dir : 0, inner: 0, snap: false };
}

/** Чем кончится жест: вкладка, раздел или возврат на место. */
export function releaseAction(mx: number, vx: number, { outer, inner, tabOnly, width }: DragInput): 'outer' | 'inner' | 'back' {
  const dir = dirOf(mx);
  const innerActive = !tabOnly && !!inner?.canGo(dir);
  if (innerActive && Math.abs(mx) > wideThreshold(width) && outer.canGo(dir)) return 'outer';
  if (innerActive) return shouldPage(mx, vx) ? 'inner' : 'back';
  return shouldPage(mx, vx) && outer.canGo(dir) ? 'outer' : 'back';
}

const sameView = (a: PagerView, b: PagerView) => a.outer === b.outer && a.inner === b.inner;

const sideOf = (el: HTMLElement): PageDir | 0 => {
  const v = Number(el.dataset.side);
  return v === 1 || v === -1 ? v : 0;
};

/**
 * Свайп между вкладками по любой части страницы (SPEC 5) и между разделами «Дел» и «Отчётов» (этап 28). С этапа 29 вкладки
 * листаются так же, как разделы: страница едет за пальцем 1:1, рядом из-за края едет соседняя вкладка, после отпускания обе
 * доезжают с того места, где были, — как страницы iOS. Строки со своим свайпом: дело — целиком своё (обе стороны),
 * запись в истории — влево «Удалить», вправо — вкладка. Вертикальный жест — обычная прокрутка.
 *
 * Плавность: движение пальца не трогает React — сдвиг пишется прямо в transform слотов (Motion, slotStyle), слоты на время
 * жеста в своих слоях. React перерисовывает только состав (какие соседи смонтированы) — несколько раз за жест и в фоне.
 */
export function useTabSwipe(outer: Pager, inner: Pager | null = null) {
  const [view, setViewState] = useState<PagerView>(IDLE_VIEW);
  const viewRef = useRef(view);
  const motion = useRef<Motion>(IDLE_MOTION);
  const els = useRef(new Set<HTMLElement>());
  const [slots] = useState<PagerSlots>(() => {
    const place = (el: HTMLElement) => {
      Object.assign(el.style, slotStyle(el.dataset.pager === 'pane' ? 'pane' : 'tab', sideOf(el), motion.current));
    };
    return {
      attach: (el) => {
        els.current.add(el);
        place(el);
        return () => void els.current.delete(el);
      },
      place,
    };
  });
  const g = useRef<{ x: number; y: number; mode: 'none' | 'swipe' | 'scroll'; id: number; row: boolean; tabOnly: boolean; samples: Sample[] } | null>(null);
  const last = useRef(0);
  /** Идёт доезд: таймер и что сделать по его окончании. Новый жест не ждёт — доезд завершается сразу (flushSettle). */
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; finish: () => void } | null>(null);
  /** Соседей показывать можно (жест длится дольше NEIGHBOR_DELAY_MS) и таймер, который это разрешит. */
  const neighbors = useRef<{ ready: boolean; timer?: ReturnType<typeof setTimeout>; latest?: PagerView }>({ ready: false });

  /**
   * sync — сразу (доезд, переключение); background — в фоне, прерываемо: соседняя вкладка может рисоваться долго (первый показ
   * «Отчётов» — подгрузка чанка, кольцо, графики), а палец не должен ждать. Синхронный рендер на pointermove блокировал поток,
   * и WebKit терял pointerup — жест «залипал» (так падали e2e на CI). Возвращает, поменялось ли что-то.
   */
  const setView = (patch: Partial<PagerView>, mode: 'sync' | 'background') => {
    const next = { ...viewRef.current, ...patch };
    if (sameView(next, viewRef.current)) return false;
    viewRef.current = next;
    if (mode === 'sync') flushSync(() => setViewState(next));
    else startTransition(() => setViewState(next));
    return true;
  };
  const move = (m: Motion) => {
    motion.current = m;
    els.current.forEach(slots.place);
  };

  /** Отпустили: сдвинуть к цели с переходом, по окончании — переключить (commit) и убрать соседей. */
  const settle = (tab: number, pane: number, patch: Partial<PagerView>, commit?: () => void) => {
    g.current = null;
    clearTimeout(neighbors.current.timer);
    neighbors.current = { ready: false };
    // Быстрый взмах обходится без соседа до отпускания — смонтировать его сейчас. Новый слот встаёт на место пальца;
    // браузер должен увидеть это место до перехода (getComputedStyle), иначе сосед появится сразу у цели, без доезда.
    if (setView(patch, 'sync')) els.current.forEach((el) => void getComputedStyle(el).transform);
    move({ tab, pane, live: true, settling: true, snap: false });
    const finish = () => {
      pending.current = null;
      motion.current = IDLE_MOTION;
      flushSync(() => {
        commit?.();
        viewRef.current = IDLE_VIEW;
        setViewState(IDLE_VIEW);
      });
      // В том же кадре, что и переключение: без перехода, со сдвигом 0 и без отдельных слоёв.
      els.current.forEach(slots.place);
    };
    pending.current = { timer: setTimeout(finish, reducedMotion() ? 0 : SETTLE_MS), finish };
  };
  /** Новый жест во время доезда: довести прежний до конца сразу, чтобы следующий свайп не пропал. */
  const flushSettle = () => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    p.finish();
  };

  const input = (tabOnly: boolean): DragInput => ({ outer, inner, tabOnly, width: window.innerWidth });

  return {
    view,
    /** Для PagerSlotsProvider: страницы и панели сообщают о себе, свайп двигает их напрямую. */
    slots,
    handlers: {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const target = e.target as HTMLElement;
        // Окна — порталы: React доставляет их события сюда же, но вкладку под окном листать не надо.
        if (!e.currentTarget.contains(target) || target.closest(SWIPE_IGNORE)) return;
        flushSettle();
        // Мышь (Safari на Mac, тесты): без этого жест у нижнего края начинал выделение текста, WebKit включал автопрокрутку
        // и переставал отдавать события указателя — свайп «залипал». Клик это не отменяет; касания не трогаем.
        if (e.pointerType === 'mouse') e.preventDefault();
        g.current = {
          x: e.clientX, y: e.clientY, mode: 'none', id: e.pointerId, row: !!target.closest(SWIPE_ROW), tabOnly: !!target.closest(SWIPE_TAB_ZONE), samples: [{ t: e.timeStamp, v: 0 }],
        };
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
            neighbors.current = {
              ready: false,
              timer: setTimeout(() => {
                neighbors.current.ready = true;
                const latest = neighbors.current.latest;
                if (latest && g.current?.mode === 'swipe') setView(latest, 'background');
              }, NEIGHBOR_DELAY_MS),
            };
          } else if (Math.abs(my) > SLOP) s.mode = 'scroll';
        }
        if (s.mode !== 'swipe') return;
        const x = slopped(mx);
        last.current = x;
        s.samples.push({ t: e.timeStamp, v: x });
        if (s.samples.length > 8) s.samples.shift();
        const d = dragOffsets(x, input(s.tabOnly));
        // Страница и панель едут сразу, прямо в style; соседи монтируются в фоне и не в первые 120 мс.
        move({ tab: d.tab, pane: d.pane, live: true, settling: false, snap: d.snap });
        const next: PagerView = { outer: d.outer, inner: d.inner };
        neighbors.current.latest = next;
        if (neighbors.current.ready) setView(next, 'background');
      },
      onPointerUp: (e: PointerEvent<HTMLElement>) => {
        const s = g.current;
        if (!s || s.mode !== 'swipe') {
          g.current = null;
          return;
        }
        const mx = last.current;
        const dir = dirOf(mx);
        const width = window.innerWidth;
        const action = releaseAction(mx, velocityOf(s.samples, e.timeStamp), input(s.tabOnly));
        if (action === 'outer') settle(-dir * width, 0, { outer: dir }, () => outer.go(dir));
        else if (action === 'inner') settle(0, -dir * width, { inner: dir, outer: 0 }, () => inner!.go(dir));
        else settle(0, 0, {});
      },
      onPointerCancel: () => {
        if (g.current?.mode === 'swipe') settle(0, 0, {});
        else g.current = null;
      },
    },
  };
}
