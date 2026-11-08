import { ChevronRight } from '../../ui/glyphs';
import type { ReactNode } from 'react';
import { useNav } from '../../app/nav';
import { BASE_CURRENCY, currencyInfo } from '../../domain/currency';
import { currencyLabel, formatAmount, formatMoney, plural } from '../../domain/money';
import type { CurrencyTotal, MoneyOverview } from '../../domain/overview';
import type { DailyLimit } from '../../domain/recurring';

/**
 * Карточка «Остаток» на «Сегодня» (SPEC 4.10, 5.1 п. 3): сколько денег всего и сколько из них уже обещано
 * (платежи до поступления, платежи дальше, долги). Этап 29: строки «Свободно / Не хватает» и «Можно тратить сегодня» убраны
 * по просьбе пользователя — внизу суммы по валютам, которые есть на счетах (нулевые не показываются).
 * 2026-11-08, по просьбе пользователя: сразу под остатком — «Можно потратить»: на счетах без копилок, платежей до зарплаты
 * и «я должен» (`free` из moneyOverview, 4.10); меньше нуля — с минусом цветом --warn, без «Не хватает». Строки
 * «Платежи дальше» нет: платежи после зарплаты платятся из неё.
 */
export function MoneyCard({ overview: o, limit, currencies }: { overview: MoneyOverview; limit: DailyLimit; currencies: readonly CurrencyTotal[] }) {
  const { push } = useNav();
  const days = `${limit.days} ${plural(limit.days, ['день', 'дня', 'дней'])}`;
  const toRecurring = () => push({ name: 'recurring', back: 'Сегодня' });
  const toDebts = () => push({ name: 'debts', back: 'Сегодня' });
  // Валют больше одной — разбивка по ним плитками ниже, в подписи остаются только копилки и валюты без курса.
  const byCurrency = currencies.length > 1;

  const parts: string[] = [];
  if (!byCurrency && (o.foreign !== 0 || o.savings !== 0)) parts.push(`в сомах ${formatAmount(o.kgs)}`);
  if (!byCurrency && o.foreign !== 0) parts.push(`в валюте ≈ ${formatAmount(o.foreign)}`);
  if (o.savings !== 0) parts.push(`копилки ${formatAmount(o.savings)}`);
  if (o.missing.length) parts.push(`${o.missing.map(currencyLabel).join(', ')}: курса нет`);

  const hasObligations = o.dueNow > 0 || o.iOwe > 0 || o.owedToMe > 0;

  return (
    <section className="card px-[18px] pt-5 pb-4" aria-label="Остаток">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] text-muted">Остаток на счетах</span>
        <span className="tabular shrink-0 rounded-full bg-sunk px-2.5 py-1 text-[12px] font-semibold text-accent">
          {limit.income ? 'до зарплаты' : 'до конца месяца'} {days}
        </span>
      </div>
      <p className="mt-1.5 flex items-baseline gap-2">
        <span className={`display-num text-limit ${o.total < 0 ? 'text-warn' : ''}`}>
          {o.approx && <span className="text-muted">≈ </span>}
          {formatAmount(o.total)}
        </span>
        <span className="text-h2 font-medium text-muted">сом</span>
      </p>
      {parts.length > 0 && <p className="tabular mt-1 text-[12px] text-muted">{parts.join(' · ')}</p>}

      <div className="mt-3 rounded-ctl bg-sunk px-3.5 py-2.5" aria-label="Можно потратить">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-semibold">Можно потратить</span>
          <span className={`tabular shrink-0 text-right ${o.free < 0 ? 'text-warn' : ''}`}>
            <span className="display-num text-[22px]">
              {o.foreign !== 0 && <span className="text-muted">≈ </span>}
              {o.free < 0 ? '−' : ''}
              {formatAmount(Math.abs(o.free))}
            </span>
            <span className="ml-1 text-[15px] font-medium text-muted">сом</span>
          </span>
        </div>
        <p className="text-[12px] text-muted">без копилок и обязательств</p>
      </div>

      <ul className="tabular mt-3 divide-y divide-line text-[14px]" aria-label="Обязательства">
        {o.dueNow > 0 && (
          <Line onClick={toRecurring} label={limit.income ? 'Платежи до зарплаты' : 'Платежи до конца месяца'} value={`−${formatAmount(o.dueNow)}`} />
        )}
        {o.iOwe > 0 && <Line onClick={toDebts} label="Я должен" value={`−${formatAmount(o.iOwe)}`} />}
        {o.owedToMe > 0 && <Line onClick={toDebts} label="Мне должны" value={`+${formatAmount(o.owedToMe)}`} valueClass="text-income" muted />}
        {!hasObligations && <Line label="Обязательств впереди нет" value="" muted />}
      </ul>

      {byCurrency && (
        <ul className="mt-3 grid grid-cols-2 gap-2" aria-label="По валютам">
          {currencies.map((c) => (
            <li key={c.currency} className="min-w-0 rounded-ctl bg-sunk px-3.5 py-2.5">
              <span className="block truncate text-[12px] text-muted">{currencyInfo(c.currency).name}</span>
              <span className={`tabular block truncate font-semibold ${c.amount < 0 ? 'text-warn' : ''}`}>{formatMoney(c.amount, c.currency)}</span>
              {c.kgs !== undefined && <span className="tabular block truncate text-[12px] text-muted">≈ {formatMoney(c.kgs, BASE_CURRENCY)}</span>}
            </li>
          ))}
        </ul>
      )}

    </section>
  );
}

function Line({
  label,
  caption,
  value,
  valueClass = '',
  muted,
  strong,
  onClick,
}: {
  label: string;
  caption?: string;
  value: ReactNode;
  valueClass?: string;
  muted?: boolean;
  strong?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className={`block ${strong ? 'font-semibold' : muted ? 'text-muted' : ''}`}>{label}</span>
        {caption && <span className="block text-[12px] text-muted">{caption}</span>}
      </span>
      <span className={`shrink-0 ${valueClass}`}>{value}</span>
      {onClick && <ChevronRight size={16} className="-mr-1 shrink-0 text-muted" aria-hidden />}
    </>
  );
  return (
    <li>
      {onClick ? (
        <button type="button" onClick={onClick} className="flex min-h-11 w-full items-center gap-2 py-2 text-left">
          {inner}
        </button>
      ) : (
        <div className="flex min-h-11 items-center gap-2 py-2">{inner}</div>
      )}
    </li>
  );
}
