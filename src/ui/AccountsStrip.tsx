import { useNav } from '../app/nav';
import { useData } from '../data/DataProvider';
import { totalInKgs } from '../domain/balance';
import { isBase } from '../domain/currency';
import { formatShortDate } from '../domain/date';
import { currencyLabel, formatAmount, formatMoney, formatRate } from '../domain/money';
import { savedRate, toKgs } from '../domain/rate';
import { IconCircle } from './icons';

/** Лента счетов на «Сегодня» (SPEC 5.1 п. 4, 4.6). */
export function AccountsStrip() {
  const { accounts, balances, settings, rateFor } = useData();
  const { showAccountHistory, push } = useNav();
  const active = accounts.filter((a) => !a.archived);
  const total = totalInKgs(active, balances, rateFor);
  const foreign = [...new Set(active.filter((a) => !isBase(a.currency)).map((a) => a.currency))];
  const outOfLimit = [...new Set(active.filter((a) => !isBase(a.currency) && !a.includeInDaily).map((a) => a.currency))];

  if (active.length === 0) {
    return (
      <section className="rounded-2xl bg-surface p-5">
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
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-h2 font-semibold">Счета</h2>
        <p className="tabular text-caption text-muted">
          Всего {total.approx ? '≈ ' : ''}
          <span className="font-semibold text-ink">{formatMoney(total.total, 'KGS')}</span>
        </p>
      </div>
      <div className="no-scrollbar -mx-5 flex snap-x gap-2.5 overflow-x-auto px-5 pb-1">
        {active.map((a) => {
          const balance = balances.get(a.id) ?? 0;
          const fx = !isBase(a.currency);
          const rate = fx ? rateFor(a.currency) : undefined;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => showAccountHistory(a.id)}
              aria-label={`${a.name}: ${formatMoney(balance, a.currency)}. Открыть историю`}
              className={`flex min-h-24 w-[148px] shrink-0 snap-start flex-col items-start gap-2 rounded-2xl p-3 text-left active:opacity-80 ${
                fx ? 'border-[1.5px] border-dashed border-crypto/60 bg-surface' : 'bg-surface'
              }`}
            >
              <div className="flex w-full items-center gap-2">
                <IconCircle name={a.icon} color={a.color} size={28} />
                <span className="min-w-0 flex-1 truncate text-caption font-medium">{a.name}</span>
              </div>
              <div>
                <p className={`tabular text-h2 font-semibold ${balance < 0 ? 'text-warn' : ''}`}>
                  {formatAmount(balance)}
                  <span className="ml-1 text-caption font-normal text-muted">{currencyLabel(a.currency)}</span>
                </p>
                {fx && (
                  <p className="tabular text-caption text-muted">
                    {rate ? `≈ ${formatMoney(toKgs(balance, rate), 'KGS')}` : 'нет курса'}
                    {a.type === 'crypto' ? ' · хранение' : ''}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
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
