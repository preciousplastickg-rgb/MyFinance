import type { ReportsMode, Tab, TasksMode } from './nav';

/**
 * Лента (этап 31, SPEC 9b): все экраны — один ряд страниц, любой свайп — ровно на одну страницу. Здесь — чистые функции:
 * порядок ленты, где пилюля меню и подсветка разделов при жесте, и физика жеста (захват, решение, доезд, резинка).
 */

/** Страница ленты: вкладка меню, у «Дел» и «Отчётов» — с разделом: 'today', 'tasks:habits', 'reports:money'. */
export type PageKey = string;

/** Направление листания: свайп влево — вперёд (+1), вправо — назад (−1). */
export type PageDir = 1 | -1;
export const dirOf = (dx: number): PageDir => (dx < 0 ? 1 : -1);

/** Порядок ленты. При «+» по центру «Цели» — раздел «Дел» (9a), место в ленте то же. */
export function laneOrder(center: boolean): readonly PageKey[] {
  return ['today', 'money', 'tasks:tasks', 'tasks:habits', center ? 'tasks:goals' : 'goals', 'reports:money', 'reports:tasks', 'reports:habits'];
}

export function pageKey(tab: Tab, tasksMode: TasksMode, reportsMode: ReportsMode): PageKey {
  if (tab === 'tasks') return `tasks:${tasksMode}`;
  if (tab === 'reports') return `reports:${reportsMode}`;
  return tab;
}

export function parsePage(key: PageKey): { tab: Tab; mode?: string } {
  const [tab, mode] = key.split(':') as [Tab, string | undefined];
  return mode ? { tab, mode } : { tab };
}

/** Соседи страницы в ленте; страницы нет в ленте (на миг, пока «Цели» переезжают при смене места «+») — соседей нет. */
export function laneNeighbors(order: readonly PageKey[], key: PageKey): { prev?: PageKey; next?: PageKey } {
  const i = order.indexOf(key);
  if (i < 0) return {};
  return { prev: order[i - 1], next: order[i + 1] };
}

/** Колонка вкладки в меню из 5 колонок: при «+» по центру средняя — место кнопки, «Цели» — в «Делах». */
export function navColumn(tab: Tab, center: boolean): number {
  if (!center) return ['today', 'money', 'tasks', 'goals', 'reports'].indexOf(tab);
  return ['today', 'money', '', 'tasks', 'reports'].indexOf(tab === 'goals' ? 'tasks' : tab);
}

/** Вкладки с панелью разделов внизу. */
export type SectionTab = 'tasks' | 'reports';

/** Панель разделов внизу: подпись для скринридера и названия разделов. */
export const SECTION_PANELS: Record<SectionTab, { label: string; titles: Record<string, string> }> = {
  tasks: { label: 'Раздел', titles: { tasks: 'Задачи', habits: 'Привычки', goals: 'Цели' } },
  reports: { label: 'Отчёт', titles: { money: 'Деньги', tasks: 'Дела', habits: 'Привычки' } },
};

/** Разделы вкладки в панели внизу; у остальных вкладок панели нет. */
export function sectionsOf(tab: Tab, center: boolean): readonly string[] | null {
  if (tab === 'tasks') return center ? ['tasks', 'habits', 'goals'] : ['tasks', 'habits'];
  if (tab === 'reports') return ['money', 'tasks', 'habits'];
  return null;
}

export interface NavFrame {
  /** Где пилюля меню: номер колонки, дробный во время жеста. */
  pill: number;
  /** Панели разделов: видимость 0–1 (уезжает вниз и гаснет) и где подсветка (номер раздела, дробный). */
  panels: Partial<Record<SectionTab, { presence: number; pos: number }>>;
}

/**
 * Меню во время жеста. progress — сколько страницы прошло к соседу: +1 — следующая страница целиком, −1 — предыдущая.
 * Жест между вкладками: пилюля едет к новой вкладке, панель уходящей гаснет, приходящей — появляется. Внутри вкладки
 * (между разделами): пилюля стоит, подсветка в панели едет.
 */
export function navFrame(order: readonly PageKey[], current: PageKey, progress: number, center: boolean): NavFrame {
  const p = Math.max(-1, Math.min(1, progress));
  const n = laneNeighbors(order, current);
  const targetKey = p > 0 ? n.next : p < 0 ? n.prev : undefined;
  const t = targetKey ? Math.abs(p) : 0;
  const a = parsePage(current);
  const b = targetKey ? parsePage(targetKey) : undefined;
  const colA = navColumn(a.tab, center);
  const colB = b ? navColumn(b.tab, center) : colA;
  const frame: NavFrame = { pill: colA + (colB - colA) * t, panels: {} };
  const sa = sectionsOf(a.tab, center);
  const posA = sa ? Math.max(0, sa.indexOf(a.mode ?? '')) : 0;
  if (sa && b?.tab === a.tab) {
    const posB = Math.max(0, sa.indexOf(b.mode ?? ''));
    frame.panels[a.tab as SectionTab] = { presence: 1, pos: posA + (posB - posA) * t };
    return frame;
  }
  const sb = b ? sectionsOf(b.tab, center) : null;
  // Панель меняется на другую («Дела · Цели» → «Отчёты» при «+» по центру): сначала уходит своя, потом приходит новая —
  // наложенные полупрозрачные надписи читаются кашей. Одна панель — появляется и гаснет вровень с жестом.
  const both = !!sa && !!sb;
  if (sa) frame.panels[a.tab as SectionTab] = { presence: both ? Math.max(0, 1 - 2 * t) : 1 - t, pos: posA };
  if (b && sb) frame.panels[b.tab as SectionTab] = { presence: both ? Math.max(0, 2 * t - 1) : t, pos: Math.max(0, sb.indexOf(b.mode ?? '')) };
  return frame;
}

/* ——— Физика жеста (как в iOS) ——— */

/** Сколько пальцу пройти, прежде чем жест решится, px. */
export const SLOP = 10;

/** Жест — горизонтальный: дальше 10 px и не круче 45° (дуга большим пальцем засчитывается). */
export function isHorizontal(mx: number, my: number): boolean {
  return Math.abs(mx) > SLOP && Math.abs(mx) > Math.abs(my);
}

/** Смещение без первых SLOP px: страница трогается с нуля, а не прыгает на 10 px в момент захвата. */
export function slopped(mx: number): number {
  return mx > SLOP ? mx - SLOP : mx < -SLOP ? mx + SLOP : 0;
}

/** Скорость при отпускании — по последним 80 мс. */
export const VELOCITY_MS = 80;
/** Рывок быстрее этого, px/мс, решает сам: в ту же сторону — переключить, в обратную — отменить. */
export const FLICK = 0.35;
/** Проекция «где остановился бы палец»: смещение + скорость × 200 мс. */
export const PROJECTION_MS = 200;

/** Куда листать после отпускания: +1 — следующая страница, −1 — предыдущая, 0 — вернуться. dx и v — палец (px, px/мс). */
export function laneStep(dx: number, v: number, width: number): PageDir | 0 {
  if (dx === 0) return 0;
  if (Math.abs(v) > FLICK) return Math.sign(v) === Math.sign(dx) ? dirOf(dx) : 0;
  const projected = dx + v * PROJECTION_MS;
  return Math.sign(projected) === Math.sign(dx) && Math.abs(projected) > width / 2 ? dirOf(dx) : 0;
}

/** Резинка на краю ленты: (1 − 1 / (dx × 0,55 / W + 1)) × W — чем дальше палец, тем меньше едет страница. */
export function rubberBand(dx: number, width: number): number {
  const d = Math.abs(dx);
  if (d === 0) return 0;
  return Math.sign(dx) * (1 - 1 / ((d * 0.55) / width + 1)) * width;
}

/** Где лента при смещении пальца raw: 1:1, но не дальше одной страницы; к краю ленты — резинка. */
export function laneOffset(raw: number, width: number, canPrev: boolean, canNext: boolean): number {
  if ((raw > 0 && !canPrev) || (raw < 0 && !canNext)) return rubberBand(raw, width);
  return Math.max(-width, Math.min(width, raw));
}

/** Обратное к laneOffset: где «палец», если лента стоит на offset, — чтобы пойманная на резинке страница не прыгнула. */
export function laneRaw(offset: number, width: number, canPrev: boolean, canNext: boolean): number {
  if ((offset > 0 && !canPrev) || (offset < 0 && !canNext)) {
    const d = Math.min(Math.abs(offset), width * 0.99);
    return (Math.sign(offset) * d * width) / (0.55 * (width - d));
  }
  return offset;
}

export const EASE_IOS = 'cubic-bezier(0.32, 0.72, 0, 1)';
export const SETTLE_MIN_MS = 180;
export const SETTLE_MAX_MS = 360;
/** Возврат с резинки — 300 мс той же кривой iOS. */
export const EDGE_RETURN_MS = 300;

/** Длительность доезда: остаток пути / скорость пальца, но не меньше 180 и не больше 360 мс; ехать некуда — 0. */
export function settleDuration(remaining: number, v: number): number {
  const d = Math.abs(remaining);
  if (d < 0.5) return 0;
  const speed = Math.abs(v);
  const t = speed > 0 ? d / speed : Infinity;
  return Math.round(Math.min(SETTLE_MAX_MS, Math.max(SETTLE_MIN_MS, t)));
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Кривая доезда, с которой страница стартует со скоростью пальца — без рывка и без паузы на отпускании. Наклон кривой
 * в начале = скорость × длительность / остаток; конец — как у iOS (0, 1). Палец стоял или шёл от цели — наклон 1:
 * спокойный старт без паузы. vToward — скорость пальца в сторону цели, px/мс.
 */
export function settleCurve(remaining: number, vToward: number, ms: number): string {
  const d = Math.abs(remaining);
  const slope = Math.max(1, d > 0 && ms > 0 ? (vToward * ms) / d : 0);
  const y1 = Math.min(1, 0.32 * slope);
  const x1 = y1 / slope;
  return `cubic-bezier(${r3(x1)}, ${r3(y1)}, 0, 1)`;
}

/**
 * Касание во время доезда ловит страницу с текущего места tx. Если лента уже ближе к новой странице (target ≠ 0 и прошла
 * половину), переход засчитывается сразу и смещение отсчитывается от новой страницы — так можно листать дальше подряд.
 */
export function caughtOffset(tx: number, target: number, width: number): { commit: boolean; offset: number } {
  if (target !== 0 && Math.abs(tx) >= width / 2) return { commit: true, offset: tx - target };
  return { commit: false, offset: tx };
}
