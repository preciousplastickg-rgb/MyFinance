import { ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNav } from '../../app/nav';
import { BASE_CURRENCY } from '../../domain/currency';
import { formatShortDate } from '../../domain/date';
import { currencyLabel, formatAmount, formatMoney, plural } from '../../domain/money';
import type { MoneyOverview } from '../../domain/overview';
import type { DailyLimit } from '../../domain/recurring';
import { LimitSheet } from './LimitSheet';

/**
 * Карточка «Остаток» на «Сегодня» (SPEC 4.10, 5.1 п. 3, этап 24): сколько денег всего, сколько из них уже обещано
 * (платежи до поступления, платежи дальше, долги) и сколько свободно; внизу — лимит на день одной строкой.
 */
export function MoneyCard({ overview: o, limit }: { overview: MoneyOverview; limit: DailyLimit }) {
  const { push } = useNav();
  const [details, setDetails] = useState(false);
  const days = `${limit.days} ${plural(limit.days, ['день', 'дня', 'дней'])}`;
  const toRecurring = () => push({ name: 'recurring', back: 'Сегодня' });
  const toDebts = () => push({ name: 'debts', back: 'Сегодня' });

  const parts: string[] = [];
  if (o.foreign !== 0 || o.savings !== 0) parts.push(`в сомах ${formatAmount(o.kgs)}`);
  if (o.foreign !== 0) parts.push(`в валюте ≈ ${formatAmount(o.foreign)}`);
  if (o.savings !== 0) parts.push(`копилки ${formatAmount(o.savings)}`);
  if (o.missing.length) parts.push(`${o.missing.map(currencyLabel).join(', ')}: курса нет`);

  const hasObligations = o.dueNow > 0 || o.dueLater > 0 || o.iOwe > 0;

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

      <ul className="tabular mt-3 divide-y divide-line text-[14px]" aria-label="Обязательства">
        {o.dueNow > 0 && (
          <Line onClick={toRecurring} label={limit.income ? 'Платежи до зарплаты' : 'Платежи до конца месяца'} value={`−${formatAmount(o.dueNow)}`} />
        )}
        {o.dueLater > 0 && <Line onClick={toRecurring} label={`Платежи дальше, до ${formatShortDate(o.laterUntil)}`} value={`−${formatAmount(o.dueLater)}`} />}
        {o.iOwe > 0 && <Line onClick={toDebts} label="Я должен" value={`−${formatAmount(o.iOwe)}`} />}
        {o.owedToMe > 0 && <Line onClick={toDebts} label="Мне должны" value={`+${formatAmount(o.owedToMe)}`} valueClass="text-income" muted />}
        {!hasObligations && <Line label="Обязательств впереди нет" value="" />}
        <Line
          label={o.free < 0 ? 'Не хватает' : 'Свободно'}
          caption={o.free < 0 ? 'на платежи и долги без копилок' : o.runwayDays !== undefined ? `без копилок · хватит на ${o.runwayDays} ${plural(o.runwayDays, ['день', 'дня', 'дней'])} обычных трат` : 'без копилок'}
          value={formatMoney(Math.abs(o.free), BASE_CURRENCY)}
          valueClass={`text-[15px] font-bold ${o.free < 0 ? 'text-warn' : ''}`}
          strong
        />
      </ul>

      {/* Лимит на день — одной строкой; тап открывает «Из чего лимит» (4.4, этап 18). */}
      <button
        type="button"
        onClick={() => setDetails(true)}
        aria-label={`Можно тратить сегодня ${formatMoney(limit.limit, BASE_CURRENCY)}. Из чего лимит`}
        className="tabular mt-3 flex w-full items-center gap-2 rounded-ctl bg-sunk px-3.5 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          {limit.status === 'shortfall' ? (
            <span className="block text-[14px] font-semibold text-warn">
              До поступления не хватает {formatMoney(limit.mandatory - limit.startOfDay, BASE_CURRENCY)} на обязательные платежи
            </span>
          ) : (
            <>
              <span className="flex items-baseline justify-between gap-2 text-[14px]">
                <span className="text-muted">Можно тратить сегодня</span>
                <span className="font-semibold">{formatMoney(limit.limit, BASE_CURRENCY)}</span>
              </span>
              <span className="mt-0.5 block text-caption text-muted">
                потрачено {formatAmount(limit.spentToday)} ·{' '}
                {limit.status === 'overspent' ? (
                  <span className="font-semibold text-warn">перерасход {formatAmount(-limit.left)}</span>
                ) : (
                  <span className="font-semibold text-ink">осталось {formatAmount(limit.left)}</span>
                )}
              </span>
            </>
          )}
        </span>
        <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
      </button>
      {details && <LimitSheet limit={limit} onClose={() => setDetails(false)} />}
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
