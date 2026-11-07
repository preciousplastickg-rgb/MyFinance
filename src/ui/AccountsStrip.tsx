import { ChevronDown } from 'lucide-react';
import { useNav } from '../app/nav';
import { useData } from '../data/DataProvider';
import { totalInKgs } from '../domain/balance';
import { BASE_CURRENCY, isBase } from '../domain/currency';
import { formatShortDate } from '../domain/date';
import { currencyLabel, formatAmount, formatMoney, formatRate } from '../domain/money';
import { savedRate, toKgs } from '../domain/rate';
import { everydayAccounts } from '../domain/savings';
import { IconCircle } from './icons';
import { SectionHeader } from './SectionHeader';
import { useRememberedOpen } from './useRememberedOpen';

/**
 * Счета на «Сегодня» (SPEC 5.1 п. 4, 4.6): заголовок «Счета · Всего ≈ N сом», тап раскрывает список.
 * Раскрыто или нет — запоминается. Тап по счёту — экран счёта (этап 25; из «Денег» тоже, этап 27), back — подпись «‹ Назад».
 */
export function AccountsStrip({
  storageKey = 'today-accounts-open',
  initialOpen = false,
  back,
}: {
  storageKey?: string;
  initialOpen?: boolean;
  back?: string;
} = {}) {
  const { accounts, balances, settings, rateFor } = useData();
  const { push } = useNav();
  const pick = (id: string) => push({ name: 'account', id, back });
  const [open, setOpen] = useRememberedOpen(storageKey, initialOpen);
  // Копилки — своим блоком ниже (этап 20).
  const active = everydayAccounts(accounts);
  const total = totalInKgs(active, balances, rateFor);
  const foreign = [...new Set(active.filter((a) => !isBase(a.currency)).map((a) => a.currency))];
  const outOfLimit = [...new Set(active.filter((a) => !isBase(a.currency) && !a.includeInDaily).map((a) => a.currency))];

  if (active.length === 0) {
    return (
      <section className="card p-4">
        <h2 className="text-h2 font-semibold">Счета</h2>
        <p className="mt-1 text-caption text-muted">Счетов пока нет.</p>
        <button type="button" onClick={() => push({ name: 'accounts' })} className="mt-2 min-h-11 font-medium text-accent">
          Добавить счёт
        </button>
      </section>
    );
  }

  return (
    <section>
      {/* Сворачивает и разворачивает тап по заголовку «Счета» — по всей ширине строки. */}
      <SectionHeader
        title="Счета"
        onClick={() => setOpen(!open)}
        expanded={open}
        label={open ? 'Свернуть счета' : 'Показать счета'}
        right={
          <span>
            Всего {total.approx ? '≈ ' : ''}
            {formatMoney(total.total, BASE_CURRENCY)}
          </span>
        }
        icon={<ChevronDown size={16} aria-hidden className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />}
      />
      {open && (
        <>
          <ul className="card divide-y divide-line overflow-hidden py-1" aria-label="Счета">
            {active.map((a) => {
              const balance = balances.get(a.id) ?? 0;
              const fx = !isBase(a.currency);
              const rate = fx ? rateFor(a.currency) : undefined;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => pick(a.id)}
                    aria-label={`${a.name}: ${formatMoney(balance, a.currency)}. Открыть счёт`}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-1.5 text-left active:bg-sunk"
                  >
                    <IconCircle name={a.icon} color={a.color} size={36} dashed={fx && !a.includeInDaily} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.name}</span>
                      <span className="block text-[12px] text-muted">{a.type === 'crypto' && !a.includeInDaily ? 'вне лимита' : a.includeInDaily ? 'в лимите' : 'вне лимита'}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={`tabular block font-semibold ${balance < 0 ? 'text-warn' : ''}`}>
                        {formatAmount(balance)}
                        {fx && <span className="font-normal text-muted"> {currencyLabel(a.currency)}</span>}
                      </span>
                      {fx && (
                        <span className="tabular block text-[12px] text-muted">{rate ? `≈ ${formatMoney(toKgs(balance, rate), BASE_CURRENCY)}` : 'нет курса'}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {foreign.length > 0 && (
            <p className="px-1 pt-2 text-[12px] text-muted">
              {outOfLimit.length > 0 && `${outOfLimit.map(currencyLabel).join(', ')} не ${outOfLimit.length > 1 ? 'входят' : 'входит'} в лимит · `}
              {(() => {
                const entries = foreign.map((c) => ({ c, r: savedRate(settings, c) }));
                const dates = new Set(entries.filter((e) => e.r).map((e) => e.r!.date));
                // Одна дата у всех курсов — пишем её один раз.
                if (dates.size === 1 && entries.every((e) => e.r)) {
                  return `курс ${entries.map((e) => `${foreign.length > 1 ? `${currencyLabel(e.c)} ` : ''}${formatRate(e.r!.rate)}`).join(' · ')} от ${formatShortDate([...dates][0]!)}`;
                }
                return entries
                  .map((e) => (e.r ? `${currencyLabel(e.c)} ${formatRate(e.r.rate)} от ${formatShortDate(e.r.date)}` : `${currencyLabel(e.c)}: курса нет`))
                  .join(' · ');
              })()}
              {total.missing.length > 0 && (
                <>
                  {' '}
                  <button type="button" onClick={() => push({ name: 'rates' })} className="min-h-11 font-medium text-accent">
                    Задать курс
                  </button>
                </>
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}
