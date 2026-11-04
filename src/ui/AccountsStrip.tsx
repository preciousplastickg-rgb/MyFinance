import { useNav } from '../app/nav';
import { useData } from '../data/DataProvider';
import { totalInKgs } from '../domain/balance';
import { formatShortDate } from '../domain/date';
import { formatAmount, formatMoney, formatRate } from '../domain/money';
import { usdtToKgs } from '../domain/rate';
import { IconCircle } from './icons';

/** Лента счетов на «Сегодня» (SPEC 5.1 п. 4). */
export function AccountsStrip() {
  const { accounts, balances, settings } = useData();
  const { showAccountHistory, push } = useNav();
  const active = accounts.filter((a) => !a.archived);
  const rate = settings.lastUsdtRate;
  const total = totalInKgs(active, balances, rate);
  const hasUsdt = active.some((a) => a.currency === 'USDT');

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
          const usdt = a.currency === 'USDT';
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => showAccountHistory(a.id)}
              aria-label={`${a.name}: ${formatMoney(balance, a.currency)}. Открыть историю`}
              className={`flex min-h-24 w-[148px] shrink-0 snap-start flex-col items-start gap-2 rounded-2xl p-3 text-left active:opacity-80 ${
                usdt ? 'border-[1.5px] border-dashed border-crypto/60 bg-surface' : 'bg-surface'
              }`}
            >
              <div className="flex w-full items-center gap-2">
                <IconCircle name={a.icon} color={a.color} size={28} />
                <span className="min-w-0 flex-1 truncate text-caption font-medium">{a.name}</span>
              </div>
              <div>
                <p className={`tabular text-h2 font-semibold ${balance < 0 ? 'text-warn' : ''}`}>
                  {formatAmount(balance)}
                  <span className="ml-1 text-caption font-normal text-muted">{usdt ? 'USDT' : 'сом'}</span>
                </p>
                {usdt && (
                  <p className="tabular text-caption text-muted">
                    {rate ? `≈ ${formatMoney(usdtToKgs(balance, rate), 'KGS')}` : 'хранение'}
                    {rate ? ' · хранение' : ''}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {hasUsdt && (
        <p className="mt-2 px-1 text-caption text-muted">
          USDT в лимит на день не входит.{' '}
          {rate && settings.lastUsdtRateDate
            ? `Курс ${formatRate(rate)} — ${formatShortDate(settings.lastUsdtRateDate)}`
            : 'Курс появится после первого перевода USDT ↔ сом.'}
        </p>
      )}
    </section>
  );
}
