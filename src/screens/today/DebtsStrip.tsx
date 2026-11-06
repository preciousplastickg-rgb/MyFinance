import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useNav, useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { BASE_CURRENCY } from '../../domain/currency';
import { addDays, formatShortDate } from '../../domain/date';
import { debtsOverview, totalKgs, type DebtState } from '../../domain/debts';
import { formatMoney } from '../../domain/money';
import { IconCircle } from '../../ui/icons';
import { SectionHeader } from '../../ui/SectionHeader';
import { useRememberedOpen } from '../../ui/useRememberedOpen';
import { DebtSheet } from '../debts/DebtSheet';

/**
 * «Долги» на «Сегодня» (этап 20): как «Счета» — свёрнуты до «Мне должны · Я должен», тап по заголовку раскрывает.
 * Просроченные и со сроком в ближайшие 7 дней видны и в свёрнутом виде. Открытых долгов нет — блока нет.
 */
export function DebtsStrip() {
  const { debts, transactions, rateFor } = useData();
  const { push } = useNav();
  const today = useToday();
  const [open, setOpen] = useRememberedOpen('today-debts-open');
  const [debtId, setDebtId] = useState<string | null>(null);
  const o = debtsOverview(debts, transactions, today);
  const all = [...o.owedToMe, ...o.iOwe];
  if (!all.length) return null;
  const soon = (s: DebtState) => !!s.debt.dueDate && s.debt.dueDate <= addDays(today, 7);
  const shown = open ? all : all.filter(soon);
  const hidden = all.length - shown.length;
  const current = debts.find((d) => d.id === debtId);
  const owed = totalKgs(o.totals.owedToMe, rateFor);
  const mine = totalKgs(o.totals.iOwe, rateFor);

  return (
    <section>
      <div className="mb-2">
        <SectionHeader
          title="Долги"
          onClick={() => setOpen(!open)}
          expanded={open}
          label={open ? 'Свернуть долги' : 'Показать долги'}
          right={open ? 'Свернуть' : hidden ? `Ещё ${hidden}` : 'Все'}
          icon={<ChevronDown size={16} aria-hidden className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />}
        />
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface" aria-label="Долги">
        {shown.map((s) => (
          <li key={s.debt.id}>
            <button
              type="button"
              onClick={() => setDebtId(s.debt.id)}
              className="flex min-h-13 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-bg"
            >
              <IconCircle name="HandCoins" color={s.debt.direction === 'owedToMe' ? '#0B7A4B' : '#B45309'} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.debt.person}</span>
                <span className={`block truncate text-caption ${s.overdue ? 'font-semibold text-warn' : 'text-muted'}`}>
                  {s.debt.direction === 'owedToMe' ? 'должен вам' : 'вы должны'}
                  {s.debt.dueDate ? ` · ${s.overdue ? 'просрочен с' : 'до'} ${formatShortDate(s.debt.dueDate)}` : ''}
                </span>
              </span>
              <span className={`tabular shrink-0 font-semibold ${s.debt.direction === 'owedToMe' ? 'text-income' : ''}`}>
                {formatMoney(s.remaining, s.debt.currency)}
              </span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => push({ name: 'debts', back: 'Сегодня' })} className={`flex min-h-13 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-bg ${open ? 'bg-bg/60' : ''}`}>
            <span className="min-w-0 flex-1 font-medium">Все долги</span>
            <span className="tabular shrink-0 text-right text-caption">
              <span className="block font-semibold text-income">мне {formatMoney(owed, BASE_CURRENCY)}</span>
              <span className="block font-semibold">я {formatMoney(mine, BASE_CURRENCY)}</span>
            </span>
          </button>
        </li>
      </ul>
      {current && <DebtSheet debt={current} onClose={() => setDebtId(null)} />}
    </section>
  );
}

