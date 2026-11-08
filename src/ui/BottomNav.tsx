import { ChartPie, ListChecks, NavToday, Plus, Target, Wallet, type GlyphIcon } from './glyphs';
import { useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { laneNeighbors, laneOrder, navFrame, pageKey, parsePage, SECTION_PANELS, sectionsOf, type SectionTab } from '../app/lane';
import { LaneBusContext, type LaneMotion } from '../app/laneContext';
import { useNav, type ReportsMode, type Tab, type TasksMode } from '../app/nav';
import { useData } from '../data/DataProvider';
import { CENTER_FAB_CY, CENTER_FAB_SIZE, CENTER_SUBNAV_GAP, CENTER_SUBNAV_HEIGHT, fabPositionOf, NAV_HEIGHT, navNotchPath, subnavNotchPath } from '../domain/appearance';

function NavItem({ icon: Icon, label, selected, onClick }: { icon: GlyphIcon; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={selected ? 'page' : undefined}
      className="mx-0.5 flex h-[52px] items-center justify-center rounded-[26px] text-nav-ink"
    >
      <Icon size={21} strokeWidth={2} aria-hidden />
    </button>
  );
}

interface TabDef { tab: Tab; icon: GlyphIcon; label: string }

const TABS: readonly TabDef[] = [
  { tab: 'today', icon: NavToday, label: 'Сегодня' },
  { tab: 'money', icon: Wallet, label: 'Деньги' },
  { tab: 'tasks', icon: ListChecks, label: 'Дела' },
  { tab: 'goals', icon: Target, label: 'Цели' },
  { tab: 'reports', icon: ChartPie, label: 'Отчёты' },
];
/** «+» по центру: 4 вкладки, средняя колонка — место кнопки; «Цели» — в «Делах». */
const CENTER_TABS: readonly (TabDef | null)[] = [TABS[0]!, TABS[1]!, null, TABS[2]!, TABS[4]!];

/** Кнопка «+» того же цвета, что меню (светлая в светлом режиме, тёмная в тёмном); обводка — токен --nav-fab-ring. */
const FAB_CLASS = 'flex items-center justify-center rounded-full bg-nav-fab-bg text-nav-fab-ink active:scale-95';

const SECTION_TABS: readonly SectionTab[] = ['tasks', 'reports'];
/** Насколько панель разделов уезжает вниз, пока гаснет, px: меньше зазора до меню (10 и 12), чтобы не заходить под него. */
export const PANEL_SLIDE = 8;
/**
 * Запас слоя панели разделов вокруг неё самой под тень, px: столько же, сколько у SVG силуэта (SHADOW_PAD), и больше
 * тени --shadow-nav при «+» справа (вниз 10 + 30).
 * Прозрачность и сдвиг при свайпе получает этот слой, а не панель: iPhone обрезает тень по рамке элемента, у которого
 * меняется прозрачность, — когда слой был размером с панель, вокруг неё оставался прямоугольник с прямыми углами.
 */
export const PANEL_SHADOW_ROOM = 50;

interface PanelRefs {
  box: HTMLDivElement | null;
  mark: HTMLSpanElement | null;
  /** Где подсветка, пока панель не участвует в жесте. */
  pos: number;
}

/**
 * Плавающее меню (SPEC 5, 9a): пилюля с вкладками без подписей, активная — пилюля-акцент; кнопка «+» слева (по умолчанию),
 * справа — зеркально, или по центру — в вырезе SVG-силуэта. Меню и кнопка одного цвета.
 *
 * Лента (этап 31): во время свайпа пилюля едет к вкладке, на которую едет страница, а панель разделов «Дел» и «Отчётов»
 * уезжает вниз и гаснет (или появляется) по прогрессу жеста; между разделами одной вкладки едет подсветка в панели.
 * Каждый кадр приходит по шине ленты и пишется прямо в style — без перерисовки React.
 */
export function BottomNav() {
  const { tab: active, tasksMode, reportsMode, setTab, openEntry, showAccountHistory, addAction, showTasks, showReports } = useNav();
  const { settings } = useData();
  const fab = fabPositionOf(settings);
  const center = fab === 'center';
  const order = useMemo(() => laneOrder(center), [center]);
  const current = pageKey(active, tasksMode, reportsMode);
  const cur = parsePage(current);
  const bus = useContext(LaneBusContext);
  const pill = useRef<HTMLSpanElement>(null);
  const strip = useRef<HTMLSpanElement>(null);
  const panels = useRef<Partial<Record<SectionTab, PanelRefs>>>({});

  // Есть разделы внизу — странице нужен запас снизу, тосту — место выше (--subnav-space, --toast-offset в index.css).
  const hasSub = !!sectionsOf(cur.tab, center);
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (hasSub) root.dataset.subnav = '';
    else delete root.dataset.subnav;
  }, [hasSub]);

  // Панели: своей вкладки (её можно трогать) и вкладок соседних страниц — заранее, невидимыми: при жесте они появляются.
  const n = laneNeighbors(order, current);
  const shown = new Map<SectionTab, string>();
  for (const key of [current, n.prev, n.next]) {
    if (!key) continue;
    const p = parsePage(key);
    if (sectionsOf(p.tab, center) && !shown.has(p.tab as SectionTab)) shown.set(p.tab as SectionTab, p.mode ?? '');
  }

  const apply = useCallback(
    (m: LaneMotion) => {
      const f = navFrame(order, current, m.progress, center);
      const ease = (props: readonly string[]) => (m.ms ? props.map((p) => `${p} ${m.ms}ms ${m.curve}`).join(', ') : '');
      if (pill.current && strip.current) {
        // Пилюля — окно в ряд значков цвета «выбрано»: едет она, ряд внутри — обратно, и значки стоят на своих местах.
        pill.current.style.transition = strip.current.style.transition = ease(['transform']);
        pill.current.style.transform = `translateX(calc(${f.pill} * (100% + 4px)))`;
        strip.current.style.transform = `translateX(calc(${f.pill} * -20%))`;
      }
      for (const t of SECTION_TABS) {
        const r = panels.current[t];
        if (!r?.box || !r.mark) continue;
        const st = f.panels[t] ?? { presence: 0, pos: r.pos };
        const box = r.box.style;
        box.transition = ease(['transform', 'opacity']);
        box.opacity = String(st.presence);
        // Уезжает вниз не дальше зазора до меню: раньше съезжала на 56 px под меню, и её края (светлее меню) выглядывали
        // вокруг него рамкой — по углам и кольцом у «+».
        box.transform = st.presence >= 1 ? '' : `translate3d(0, ${(1 - st.presence) * PANEL_SLIDE}px, 0)`;
        box.visibility = st.presence <= 0 && !m.ms ? 'hidden' : '';
        // Сам слой шире панели и касаний не ловит никогда; нажимается только панель — когда видна целиком.
        box.setProperty('--subnav-events', st.presence >= 1 ? 'auto' : 'none');
        r.mark.style.transition = ease(['transform']);
        r.mark.style.transform = `translateX(calc(${st.pos} * (100% + 2px)))`;
      }
    },
    [order, current, center],
  );
  // На каждом рендере (сменилась страница) — встать по текущему кадру; потом — по шине, кадр за кадром.
  useLayoutEffect(() => {
    apply(bus.get());
    return bus.subscribe(apply);
  }, [bus, apply]);

  const sub = [...shown].map(([t, mode]) => {
    const sections = sectionsOf(t, center)!;
    const { label, titles } = SECTION_PANELS[t];
    const own = t === cur.tab;
    return (
      <SubNavBar
        key={t}
        label={label}
        options={sections.map((v) => ({ value: v, label: titles[v] ?? v }))}
        value={own ? (cur.mode ?? '') : mode}
        interactive={own}
        center={center}
        onChange={(v) => (t === 'tasks' ? showTasks(v as TasksMode) : showReports(v as ReportsMode))}
        refs={(r) => {
          const prev = panels.current[t];
          panels.current[t] = { box: r.box ?? prev?.box ?? null, mark: r.mark ?? prev?.mark ?? null, pos: Math.max(0, sections.indexOf(own ? (cur.mode ?? '') : mode)) };
        }}
      />
    );
  });

  // «+» делает то, что объявил открытый экран (задача, привычка, цель — этап 28), иначе — новая запись.
  const plusLabel = addAction?.label ?? 'Новая запись';
  const onPlus = () => (addAction ? addAction.run() : openEntry());
  const go = (t: Tab) => (t === 'money' ? showAccountHistory(null) : setTab(t));
  const items = (defs: readonly (TabDef | null)[]) => [
    ...defs.map((t, i) =>
      t ? (
        <NavItem key={t.tab} icon={t.icon} label={t.label} selected={active === t.tab || (t.tab === 'tasks' && center && active === 'goals')} onClick={() => go(t.tab)} />
      ) : (
        <span key={`gap-${i}`} aria-hidden />
      ),
    ),
    <NavPill key="pill" defs={defs} pill={pill} strip={strip} />,
  ];

  if (center)
    return (
      <>
        {sub}
        <CenterNav plusLabel={plusLabel} onPlus={onPlus}>{items(CENTER_TABS)}</CenterNav>
      </>
    );

  const plus = (
    <button type="button" onClick={onPlus} aria-label={plusLabel} className={`size-16 shrink-0 ${FAB_CLASS}`} style={{ boxShadow: 'var(--nav-fab-ring), var(--shadow-fab)' }}>
      <Plus size={28} strokeWidth={2.25} aria-hidden />
    </button>
  );
  return (
    <>
      {sub}
      <nav aria-label="Основное меню" className="fixed inset-x-4 z-10 mx-auto flex max-w-lg items-center gap-2.5" style={{ bottom: 'var(--nav-bottom)' }}>
        {fab === 'left' && plus}
        <div className="relative grid h-16 flex-1 grid-cols-5 items-center rounded-[32px] bg-nav-bg px-1.5 shadow-nav">{items(TABS)}</div>
        {fab === 'right' && plus}
      </nav>
    </>
  );
}

/**
 * Пилюля активной вкладки — отдельный слой поверх кнопок (этап 31), чтобы ехать за жестом. Внутри — тот же ряд значков
 * цветом «выбрано»: пилюля сдвигается на колонку, ряд — на столько же обратно, поэтому значок под пилюлей всегда свой.
 * Геометрия — как у кнопок: колонка = (ширина − 12) / 5, кнопка на 2 px уже с каждой стороны, высота 52, сверху 6.
 */
function NavPill({ defs, pill, strip }: { defs: readonly (TabDef | null)[]; pill: RefObject<HTMLSpanElement>; strip: RefObject<HTMLSpanElement> }) {
  return (
    <span
      ref={pill}
      aria-hidden
      data-nav-pill
      className="pointer-events-none absolute top-1.5 left-2 h-[52px] w-[calc((100%-12px)/5-4px)] overflow-hidden rounded-[26px] bg-nav-pill will-change-transform"
    >
      <span ref={strip} className="absolute inset-y-0 -left-0.5 grid w-[calc(500%+20px)] grid-cols-5 text-nav-pill-ink will-change-transform">
        {defs.map((t, i) => (
          <span key={t?.tab ?? `gap-${i}`} className="flex items-center justify-center">
            {t && <t.icon size={21} strokeWidth={2} aria-hidden />}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Тень силуэта — та же, что давал `filter: drop-shadow(0 10px 18px …)` в WebKit: вниз на 10, σ 14 (подобрано по снимкам:
 * расхождение ≤ 4 из 255). Цвет — токен --shadow-notch-color.
 */
export const NOTCH_SHADOW = { dy: 10, blur: 14 } as const;
/** Запас SVG вокруг силуэта, px: тень (10 + 3σ = 52 вниз) внутри самого SVG — на его краю она уже меньше 1/1000. */
export const SHADOW_PAD = 50;

/**
 * Силуэт меню или панели с вырезом под «+»: путь в координатах фигуры, SVG шире и выше на SHADOW_PAD с каждой стороны.
 * `left` / `top` — где стоит фигура в содержащем блоке (по умолчанию в его углу).
 *
 * Тень рисуется внутри SVG — размытой копией фигуры под ней (SVG-фильтр), а не CSS `filter: drop-shadow`: на iPhone
 * CSS-тень панели разделов обрезалась по рамке панели, и вокруг неё был виден прямоугольник (два снимка 2026-11-08).
 */
function Silhouette({
  d,
  width,
  height,
  className,
  left = '0px',
  top = 0,
  ...data
}: { d: string; width: number; height: number; className: string; left?: string; top?: number } & Record<`data-${string}`, string>) {
  const P = SHADOW_PAD;
  const id = `notch-shadow-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg
      {...data}
      width={width + 2 * P}
      height={height + 2 * P}
      viewBox={`${-P} ${-P} ${width + 2 * P} ${height + 2 * P}`}
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
      style={{ left: `calc(${left} - ${P}px)`, top: top - P }}
    >
      <defs>
        <filter id={id} filterUnits="userSpaceOnUse" x={-P} y={-P} width={width + 2 * P} height={height + 2 * P} colorInterpolationFilters="sRGB">
          <feOffset dy={NOTCH_SHADOW.dy} />
          <feGaussianBlur stdDeviation={NOTCH_SHADOW.blur} />
        </filter>
      </defs>
      <path data-shadow d={d} filter={`url(#${id})`} style={{ fill: 'var(--shadow-notch-color)' }} />
      <path d={d} fill="currentColor" />
    </svg>
  );
}

/** Ширина элемента — из ResizeObserver: силуэты с вырезом рисуются под реальную ширину, без растяжения. */
function useWidth(ref: RefObject<HTMLElement>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/**
 * Разделы экрана над меню (этап 29): «Задачи / Привычки / Цели», «Деньги / Дела / Привычки» — там, где их достаёт большой палец.
 * Цвет — на волос светлее меню (--subnav-bg). При «+» по центру панель — зеркало меню: стоит прямо над ним и вырезом снизу
 * обнимает кнопку сверху (subnavNotchPath), разделы — в верхней части, над вырезом. Подсветка выбранного — отдельный слой
 * (этап 31): едет за жестом между разделами; видимость панели — по прогрессу жеста (BottomNav пишет их в style).
 */
function SubNavBar({
  label,
  options,
  value,
  interactive,
  center,
  onChange,
  refs,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  interactive: boolean;
  center: boolean;
  onChange: (value: string) => void;
  refs: (r: { box?: HTMLDivElement | null; mark?: HTMLSpanElement | null }) => void;
}) {
  const count = options.length;
  const panel = useRef<HTMLDivElement>(null);
  const width = useWidth(panel);
  const group = (
    <div
      role="radiogroup"
      aria-label={label}
      className={`relative grid auto-cols-fr grid-flow-col gap-0.5 p-1 ${center ? '' : 'rounded-[22px] bg-subnav-bg shadow-nav'}`}
    >
      <span
        ref={(mark) => mark && refs({ mark })}
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 rounded-[18px] bg-surface shadow-[0_1px_3px_rgba(0,0,0,.12)]"
        style={{ width: `calc((100% - 8px - ${(count - 1) * 2}px) / ${count})` }}
      />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={interactive ? undefined : -1}
            onClick={() => onChange(o.value)}
            className={`tap-44 min-h-9 rounded-[18px] px-2 text-sub font-semibold ${on ? 'text-ink' : 'text-nav-ink'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
  // Слой (прозрачность и сдвиг при свайпе) — во всю ширину экрана и на PANEL_SHADOW_ROOM выше и ниже панели: тень целиком
  // внутри него, iPhone её не обрезает. Сама панель — на прежнем месте: поля 16 px, не шире max-w-lg.
  const room = PANEL_SHADOW_ROOM;
  const gap = center ? NAV_HEIGHT + CENTER_SUBNAV_GAP : NAV_HEIGHT + 10;
  return (
    <div
      ref={(el) => {
        if (el) refs({ box: el });
      }}
      aria-hidden={interactive ? undefined : true}
      data-subnav-layer={label}
      className="pointer-events-none fixed inset-x-0 z-10 px-4"
      style={{ bottom: `calc(var(--nav-bottom) + ${gap - room}px)`, paddingTop: room, paddingBottom: room }}
    >
      {/* Силуэт — прямо в слое, не внутри панели: между тенью и слоем нет элемента размером с панель, обрезать её не по чему. */}
      {center && width > 0 && (
        <Silhouette
          d={subnavNotchPath(width)}
          width={width}
          height={CENTER_SUBNAV_HEIGHT}
          left={`calc(50% - ${width / 2}px)`}
          top={room}
          className="text-subnav-bg"
          data-subnav-shape=""
        />
      )}
      <div
        ref={panel}
        data-subnav-panel={label}
        className="relative mx-auto max-w-lg [pointer-events:var(--subnav-events,auto)]"
        style={center ? { height: CENTER_SUBNAV_HEIGHT } : undefined}
      >
        {group}
      </div>
    </div>
  );
}

/**
 * «+» по центру: силуэт пилюли с вырезом под кнопку (путь из SPEC 9a) рисуется под реальную ширину меню — из ResizeObserver,
 * viewBox той же ширины, без растяжения, поэтому вырез круглый на любом экране. Кнопка 60 px, центр на 10 px ниже верха.
 */
function CenterNav({ children, plusLabel, onPlus }: { children: ReactNode; plusLabel: string; onPlus: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const width = useWidth(ref);
  return (
    <nav ref={ref} aria-label="Основное меню" className="fixed inset-x-4 z-10 mx-auto h-16 max-w-lg" style={{ bottom: 'var(--nav-bottom)' }}>
      {width > 0 && (
        <Silhouette d={navNotchPath(width)} width={width} height={NAV_HEIGHT} className="text-nav-bg" data-nav-shape="" />
      )}
      <div className="relative grid h-16 grid-cols-5 items-center px-1.5">{children}</div>
      <button
        type="button"
        onClick={onPlus}
        aria-label={plusLabel}
        className={`absolute left-1/2 -translate-x-1/2 ${FAB_CLASS}`}
        style={{ width: CENTER_FAB_SIZE, height: CENTER_FAB_SIZE, top: CENTER_FAB_CY - CENTER_FAB_SIZE / 2, boxShadow: 'var(--nav-fab-ring)' }}
      >
        <Plus size={27} strokeWidth={2.25} aria-hidden />
      </button>
    </nav>
  );
}
