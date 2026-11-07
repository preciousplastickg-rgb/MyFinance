import { CalendarDays, ChartPie, ListChecks, Plus, Target, Wallet, type LucideIcon } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useNav, type Tab } from '../app/nav';
import { useData } from '../data/DataProvider';
import { CENTER_FAB_CY, CENTER_FAB_SIZE, fabPositionOf, NAV_HEIGHT, navNotchPath } from '../domain/appearance';

function NavItem({ icon: Icon, label, selected, onClick }: { icon: LucideIcon; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={selected ? 'page' : undefined}
      className={`mx-0.5 flex h-[52px] items-center justify-center rounded-[26px] transition-colors duration-150 ${
        selected ? 'bg-nav-pill text-nav-pill-ink' : 'text-nav-ink'
      }`}
    >
      <Icon size={21} strokeWidth={2} aria-hidden />
    </button>
  );
}

interface TabDef { tab: Tab; icon: LucideIcon; label: string }

const TABS: readonly TabDef[] = [
  { tab: 'today', icon: CalendarDays, label: 'Сегодня' },
  { tab: 'money', icon: Wallet, label: 'Деньги' },
  { tab: 'tasks', icon: ListChecks, label: 'Дела' },
  { tab: 'goals', icon: Target, label: 'Цели' },
  { tab: 'reports', icon: ChartPie, label: 'Отчёты' },
];
/** «+» по центру: 4 вкладки, средняя колонка — место кнопки; «Цели» — в «Делах». */
const CENTER_TABS: readonly (TabDef | null)[] = [TABS[0]!, TABS[1]!, null, TABS[2]!, TABS[4]!];

/** Кнопка «+» того же цвета, что меню (светлая в светлом режиме, тёмная в тёмном); обводка — токен --nav-fab-ring. */
const FAB_CLASS = 'flex items-center justify-center rounded-full bg-nav-fab-bg text-nav-fab-ink transition-transform duration-150 active:scale-95';

/**
 * Плавающее меню (SPEC 5, 9a): пилюля с вкладками без подписей, активная — пилюля-акцент; кнопка «+» слева (по умолчанию),
 * справа — зеркально, или по центру — в вырезе SVG-силуэта. Меню и кнопка одного цвета.
 */
export function BottomNav() {
  const { tab: active, setTab, openEntry, showAccountHistory, addAction } = useNav();
  const { settings } = useData();
  const fab = fabPositionOf(settings);
  // «+» делает то, что объявил открытый экран (задача, привычка, цель — этап 28), иначе — новая запись.
  const plusLabel = addAction?.label ?? 'Новая запись';
  const onPlus = () => (addAction ? addAction.run() : openEntry());
  const go = (t: Tab) => (t === 'money' ? showAccountHistory(null) : setTab(t));
  const items = (defs: readonly (TabDef | null)[]) =>
    defs.map((t, i) =>
      t ? (
        <NavItem key={t.tab} icon={t.icon} label={t.label} selected={active === t.tab || (t.tab === 'tasks' && fab === 'center' && active === 'goals')} onClick={() => go(t.tab)} />
      ) : (
        <span key={`gap-${i}`} aria-hidden />
      ),
    );

  if (fab === 'center') return <CenterNav plusLabel={plusLabel} onPlus={onPlus}>{items(CENTER_TABS)}</CenterNav>;

  const plus = (
    <button type="button" onClick={onPlus} aria-label={plusLabel} className={`size-16 shrink-0 ${FAB_CLASS}`} style={{ boxShadow: 'var(--nav-fab-ring), var(--shadow-fab)' }}>
      <Plus size={28} strokeWidth={2.25} aria-hidden />
    </button>
  );
  return (
    <nav aria-label="Основное меню" className="fixed inset-x-4 z-10 mx-auto flex max-w-lg items-center gap-2.5" style={{ bottom: 'var(--nav-bottom)' }}>
      {fab === 'left' && plus}
      <div className="grid h-16 flex-1 grid-cols-5 items-center rounded-[32px] bg-nav-bg px-1.5 shadow-nav">{items(TABS)}</div>
      {fab === 'right' && plus}
    </nav>
  );
}

/**
 * «+» по центру: силуэт пилюли с вырезом под кнопку (путь из SPEC 9a) рисуется под реальную ширину меню — из ResizeObserver,
 * viewBox той же ширины, без растяжения, поэтому вырез круглый на любом экране. Кнопка 60 px, центр на 10 px ниже верха.
 */
function CenterNav({ children, plusLabel, onPlus }: { children: ReactNode; plusLabel: string; onPlus: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <nav ref={ref} aria-label="Основное меню" className="fixed inset-x-4 z-10 mx-auto h-16 max-w-lg" style={{ bottom: 'var(--nav-bottom)' }}>
      {width > 0 && (
        <svg data-nav-shape width={width} height={NAV_HEIGHT} viewBox={`0 0 ${width} ${NAV_HEIGHT}`} aria-hidden className="absolute inset-0 overflow-visible text-nav-bg" style={{ filter: 'var(--shadow-notch)' }}>
          <path d={navNotchPath(width)} fill="currentColor" />
        </svg>
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
