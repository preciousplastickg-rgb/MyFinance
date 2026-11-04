import { CalendarDays, ListChecks, PieChart, Plus, Wallet, type LucideIcon } from 'lucide-react';
import { useNav } from '../app/nav';

function NavItem({
  icon: Icon,
  label,
  selected,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? 'page' : undefined}
      className={`flex min-h-11 flex-col items-center justify-center gap-0.5 text-nav font-medium ${
        selected ? 'text-accent' : 'text-muted'
      }`}
    >
      <Icon size={24} strokeWidth={selected ? 2.25 : 1.75} aria-hidden />
      {label}
    </button>
  );
}

/** Сегодня · Деньги · [+] · Дела · Отчёты (SPEC 5). */
export function BottomNav() {
  const { tab: active, setTab: onSelect, openEntry, showAccountHistory } = useNav();
  const onAdd = () => openEntry();
  return (
    <nav
      aria-label="Основное меню"
      className="pb-safe fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface"
    >
      <div className="mx-auto grid h-[var(--nav-height)] max-w-lg grid-cols-5 items-center">
        <NavItem icon={CalendarDays} label="Сегодня" selected={active === 'today'} onClick={() => onSelect('today')} />
        <NavItem icon={Wallet} label="Деньги" selected={active === 'money'} onClick={() => showAccountHistory(null)} />
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Новая запись"
            className="flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/25 active:scale-95 transition-transform duration-150"
          >
            <Plus size={28} strokeWidth={2.25} aria-hidden />
          </button>
        </div>
        <NavItem icon={ListChecks} label="Дела" selected={active === 'tasks'} onClick={() => onSelect('tasks')} />
        <NavItem icon={PieChart} label="Отчёты" selected={active === 'reports'} onClick={() => onSelect('reports')} />
      </div>
    </nav>
  );
}
