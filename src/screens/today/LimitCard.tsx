import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { addDays, weekdayOf } from '../../domain/date';
import { LimitSheet } from './LimitSheet';
import { formatAmount, formatMoney, plural } from '../../domain/money';
import type { DailyLimit } from '../../domain/recurring';
import { BASE_CURRENCY } from '../../domain/currency';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
/** Столбиков не больше семи: при более долгом сроке последний отвечает за все оставшиеся дни и подписан «+N». */
const MAX_BARS = 7;

/** Дни до поступления для столбиков: сегодня первым, подписи — дни недели. */
export function limitBars(today: string, days: number): { label: string; today: boolean }[] {
  const n = Math.min(days, MAX_BARS);
  return Array.from({ length: n }, (_, i) => ({
    label: days > MAX_BARS && i === n - 1 ? `+${days - (n - 1)}` : WEEKDAYS[weekdayOf(addDays(today, i)) - 1]!,
    today: i === 0,
  }));
}

/** «Можно тратить сегодня», вариант heroBars (HANDOFF, «Сегодня»; расчёт — SPEC 4.4). */
export function LimitCard({ limit, today }: { limit: DailyLimit; today: string }) {
  const [details, setDetails] = useState(false);
  const days = `${limit.days} ${plural(limit.days, ['день', 'дня', 'дней'])}`;
  const overspent = limit.status === 'overspent';
  // Первый столбик залит на долю остатка; при перерасходе — целиком цветом --warn.
  const leftShare = overspent ? 100 : limit.limit > 0 ? Math.round((Math.max(0, limit.left) * 100) / limit.limit) : 0;
  const bars = limitBars(today, limit.days);

  return (
    <section className="card px-[18px] pt-5 pb-4" aria-label="Лимит на день">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] text-muted">Можно тратить сегодня</span>
        <span className="tabular shrink-0 rounded-full bg-sunk px-2.5 py-1 text-[12px] font-semibold text-accent">
          {limit.income ? 'до зарплаты' : 'до конца месяца'} {days}
        </span>
      </div>
      {limit.status === 'shortfall' ? (
        <p className="mt-2 text-h2 font-semibold text-warn">
          До поступления не хватает {formatMoney(limit.mandatory - limit.startOfDay, BASE_CURRENCY)} на обязательные платежи
        </p>
      ) : (
        <>
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="display-num text-limit">{formatAmount(limit.limit)}</span>
            <span className="text-h2 font-medium text-muted">сом</span>
          </p>
          <div className="mt-[18px] grid gap-1.5" style={{ gridTemplateColumns: `repeat(${bars.length}, 1fr)` }} aria-hidden>
            {bars.map((b, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="relative h-11 overflow-hidden rounded-bar bg-sunk">
                  <div
                    className="absolute inset-x-0 bottom-0 transition-[height] duration-400"
                    style={{ height: b.today ? `${leftShare}%` : '100%', background: b.today ? (overspent ? 'var(--warn)' : 'var(--hero-fill)') : 'var(--hero-fill-soft)' }}
                  />
                </div>
                <span className={`text-center text-[11px] ${b.today ? 'font-bold text-ink' : 'font-medium text-muted'}`}>{b.label}</span>
              </div>
            ))}
          </div>
          <div
            className="tabular mt-3 flex justify-between text-[14px]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={100 - leftShare}
            aria-label="Потрачено от лимита"
          >
            <span className="whitespace-nowrap text-muted">Потрачено {formatAmount(limit.spentToday)}</span>
            {overspent ? (
              <span className="whitespace-nowrap font-bold text-warn">Перерасход {formatAmount(-limit.left)}</span>
            ) : (
              <span className="whitespace-nowrap font-bold">Осталось {formatAmount(limit.left)}</span>
            )}
          </div>
        </>
      )}
      {/* Тап — из чего сложился лимит, с переходами к счетам, платежам и тратам (этап 18). */}
      <button
        type="button"
        onClick={() => setDetails(true)}
        className="tabular mt-3 flex w-full items-center gap-2 rounded-ctl bg-sunk px-3.5 py-3 text-left text-caption text-muted"
      >
        <span className="min-w-0 flex-1">
          {formatAmount(limit.startOfDay)} на счетах − {formatAmount(limit.mandatory)} обязательных = {formatAmount(Math.max(0, limit.free))} на {days}
          {!limit.income && ' · источников дохода нет'}
        </span>
        <ChevronRight size={16} className="shrink-0" aria-hidden />
      </button>
      {details && <LimitSheet limit={limit} onClose={() => setDetails(false)} />}
    </section>
  );
}
