import { CalendarDays, ChartPie, ListChecks, Plus, Target, Wallet, type LucideIcon } from 'lucide-react';
import { useNav, type Tab } from '../app/nav';

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

const TABS: readonly { tab: Tab; icon: LucideIcon; label: string }[] = [
  { tab: 'today', icon: CalendarDays, label: 'Сегодня' },
  { tab: 'money', icon: Wallet, label: 'Деньги' },
  { tab: 'tasks', icon: ListChecks, label: 'Дела' },
  { tab: 'goals', icon: Target, label: 'Цели' },
  { tab: 'reports', icon: ChartPie, label: 'Отчёты' },
];

/** Плавающее меню: 5 вкладок без подписей, активная — коралловая пилюля; справа FAB «+» (HANDOFF, «Оболочка»). */
export function BottomNav() {
  const { tab: active, setTab, openEntry, showAccountHistory } = useNav();
  return (
    <nav
      aria-label="Основное меню"
      className="fixed inset-x-4 z-10 mx-auto flex max-w-lg items-center gap-2.5"
      style={{ bottom: 'var(--nav-bottom)' }}
    >
      <div className="grid h-16 flex-1 grid-cols-5 items-center rounded-[32px] bg-nav-bg px-1.5 shadow-nav">
        {TABS.map((t) => (
          <NavItem
            key={t.tab}
            icon={t.icon}
            label={t.label}
            selected={active === t.tab}
            onClick={() => (t.tab === 'money' ? showAccountHistory(null) : setTab(t.tab))}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => openEntry()}
        aria-label="Новая запись"
        className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-fab transition-transform duration-150 active:scale-95"
      >
        <Plus size={28} strokeWidth={2.25} aria-hidden />
      </button>
    </nav>
  );
}
