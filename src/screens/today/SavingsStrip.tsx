import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useNav, useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { BASE_CURRENCY } from '../../domain/currency';
import { formatMoney, plural } from '../../domain/money';
import { activeJars, jarState, savingsTotals } from '../../domain/savings';
import { IconCircle } from '../../ui/icons';
import { SectionHeader } from '../../ui/SectionHeader';
import { useRememberedOpen } from '../../ui/useRememberedOpen';
import { JarSheet } from '../savings/JarSheet';
import { colorCss } from '../../domain/catalog';

/** «Копилка» на «Сегодня» (этап 20): как «Счета» — свёрнута до итога, тап по заголовку раскрывает. */
export function SavingsStrip() {
  const { accounts, balances, rateFor } = useData();
  const { push } = useNav();
  const today = useToday();
  const [open, setOpen] = useRememberedOpen('today-savings-open');
  const [jarId, setJarId] = useState<string | null>(null);
  const jars = activeJars(accounts);
  const totals = savingsTotals(jars, balances, rateFor);
  const current = jars.find((j) => j.id === jarId);

  return (
    <section>
      <div>
        <SectionHeader
          title="Копилка"
          onClick={() => (jars.length ? setOpen(!open) : push({ name: 'savings', back: 'Сегодня' }))}
          expanded={jars.length ? open : undefined}
          label={jars.length ? (open ? 'Свернуть копилку' : 'Показать копилку') : 'Копилка: завести'}
          right={jars.length ? (open ? 'Свернуть' : 'Показать') : 'Завести'}
          icon={jars.length ? <ChevronDown size={16} aria-hidden className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} /> : undefined}
        />
      </div>
      {/* Копилок нет — одной строки заголовка «Завести» достаточно, вторая карточка только дублировала её. */}
      {jars.length > 0 && (
      <ul className="card divide-y divide-line overflow-hidden py-1" aria-label="Копилка">
        {open &&
          jars.map((j) => {
            const s = jarState(j, balances.get(j.id) ?? 0, today);
            return (
              <li key={j.id}>
                <button
                  type="button"
                  onClick={() => setJarId(j.id)}
                  aria-label={`${j.name}: ${formatMoney(s.balance, j.currency)}`}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-1.5 text-left active:bg-sunk"
                >
                  <IconCircle name={j.icon} color={j.color} size={36} />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block truncate font-medium">{j.name}</span>
                    {s.percent !== undefined && (
                      <span className="block h-1.5 overflow-hidden rounded-[3px] bg-sunk">
                        <span className="jar-fill block h-full rounded-[3px]" style={{ width: `${s.percent}%`, background: colorCss(j.color) }} />
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="tabular block font-semibold">{formatMoney(s.balance, j.currency)}</span>
                    {s.percent !== undefined && <span className="tabular block text-caption text-muted">{s.percent}%</span>}
                  </span>
                </button>
              </li>
            );
          })}
        <li>
          <button type="button" onClick={() => push({ name: 'savings', back: 'Сегодня' })} className={`flex min-h-14 w-full items-center gap-3 px-4 py-1.5 text-left active:bg-sunk ${open ? 'bg-sunk/50' : ''}`}>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Всего накоплено</span>
              {!open && (
                <span className="block text-caption text-muted">
                  {jars.length} {plural(jars.length, ['копилка', 'копилки', 'копилок'])}
                </span>
              )}
            </span>
            <span className="tabular shrink-0 font-semibold">
              {totals.approx ? '≈ ' : ''}
              {formatMoney(totals.kgs, BASE_CURRENCY)}
            </span>
          </button>
        </li>
      </ul>
      )}
      {current && <JarSheet jar={current} onClose={() => setJarId(null)} />}
    </section>
  );
}
