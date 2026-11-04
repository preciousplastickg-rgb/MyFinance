import { useNav } from '../app/nav';
import { useData } from '../data/DataProvider';
import { totalInKgs } from '../domain/balance';
import { isBase } from '../domain/currency';
import { formatShortDate } from '../domain/date';
import { currencyLabel, formatAmount, formatMoney, formatRate } from '../domain/money';
import { savedRate, toKgs } from '../domain/rate';
import { IconCircle } from './icons';

/** Счета на «Сегодня»: все сразу списком, итог последней строкой (SPEC 5.1 п. 4, 4.6). */
export function AccountsStrip() {
  const { accounts, balances, settings, rateFor } = useData();
  const { showAccountHistory, push } = useNav();
  const active = accounts.filter((a) => !a.archived);
  const total = totalInKgs(active, balances, rateFor);
  const foreign = [...new Set(active.filter((a) => !isBase(a.currency)).map((a) => a.currency))];
  const outOfLimit = [...new Set(active.filter((a) => !isBase(a.currency) && !a.includeInDaily).map((a) => a.currency))];

  if (active.length === 0) {
    return (
      <section className="rounded-card bg-surface p-4">
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
      <h2 className="mb-2 px-1 text-h2 font-semibold">Счета</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface" aria-label="Счета">
        {active.map((a) => {
          const balance = balances.get(a.id) ?? 0;
          const fx = !isBase(a.currency);
          const rate = fx ? rateFor(a.currency) : undefined;
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => showAccountHistory(a.id)}
                aria-label={`${a.name}: ${formatMoney(balance, a.currency)}. Открыть историю`}
                className="flex min-h-13 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-bg"
              >
                <IconCircle name={a.icon} color={a.color} size={32} dashed={fx} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{a.name}</span>
                  {fx && <span className="block text-caption text-muted">{a.type === 'crypto' ? 'хранение' : a.includeInDaily ? 'в лимите' : 'вне лимита'}</span>}
                </span>
                <span className="shrink-0 text-right">
                  <span className={`tabular block font-semibold ${balance < 0 ? 'text-warn' : ''}`}>
                    {formatAmount(balance)} <span className="font-normal text-muted">{currencyLabel(a.currency)}</span>
                  </span>
                  {fx && (
                    <span className="tabular block text-caption text-muted">{rate ? `≈ ${formatMoney(toKgs(balance, rate), 'KGS')}` : 'нет курса'}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
        <li className="flex min-h-12 items-center justify-between bg-bg/60 px-4 py-2.5">
          <span className="font-medium">Всего</span>
          <span className="tabular font-semibold">
            {total.approx ? '≈ ' : ''}
            {formatMoney(total.total, 'KGS')}
          </span>
        </li>
      </ul>
      {foreign.length > 0 && (
        <p className="mt-2 px-1 text-caption text-muted">
          {outOfLimit.length > 0 && `${outOfLimit.map(currencyLabel).join(', ')} в лимит на день не ${outOfLimit.length > 1 ? 'входят' : 'входит'}. `}
          {(() => {
            const entries = foreign.map((c) => ({ c, r: savedRate(settings, c) }));
            const dates = new Set(entries.filter((e) => e.r).map((e) => e.r!.date));
            // Одна дата у всех курсов — пишем её один раз.
            if (dates.size === 1 && entries.every((e) => e.r)) {
              return `Курсы на ${formatShortDate([...dates][0]!)}: ${entries.map((e) => `${currencyLabel(e.c)} ${formatRate(e.r!.rate)}`).join(' · ')}`;
            }
            return entries
              .map((e) => (e.r ? `${currencyLabel(e.c)} ${formatRate(e.r.rate)} — ${formatShortDate(e.r.date)}` : `${currencyLabel(e.c)}: курса нет`))
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
    </section>
  );
}
