import { formatShortDate } from '../../domain/date';
import { formatAmount, formatMoney, plural } from '../../domain/money';
import type { DailyLimit } from '../../domain/recurring';

const WARN_ON_DARK = '#FDBA74';

/** «Можно тратить сегодня» (SPEC 5.1 п. 3, расчёт — 4.4). */
export function LimitCard({ limit }: { limit: DailyLimit }) {
  const days = `${limit.days} ${plural(limit.days, ['день', 'дня', 'дней'])}`;
  const until = limit.income
    ? `до «${limit.income.recurring.name}» (${formatShortDate(limit.income.dueDate)})`
    : 'до конца месяца';
  const overspent = limit.status === 'overspent';
  const progress = limit.limit > 0 ? Math.min(100, Math.round((limit.spentToday * 100) / limit.limit)) : 100;

  return (
    <section className="rounded-[20px] bg-primary p-5 text-white" aria-label="Лимит на день">
      <p className="text-caption text-white/75">Можно тратить сегодня</p>
      {limit.status === 'shortfall' ? (
        <p className="mt-2 text-h2 font-semibold" style={{ color: WARN_ON_DARK }}>
          До поступления не хватает {formatMoney(limit.mandatory - limit.startOfDay, 'KGS')} на обязательные платежи
        </p>
      ) : (
        <>
          <p className="tabular mt-1 text-limit font-bold">
            {formatAmount(limit.limit)}
            <span className="ml-1.5 text-h2 font-medium text-white/75">сом</span>
          </p>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Потрачено от лимита"
          >
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: overspent ? WARN_ON_DARK : '#7DD3A8' }} />
          </div>
          <div className="tabular mt-2 flex justify-between text-caption">
            <span className="text-white/75">Потрачено {formatAmount(limit.spentToday)}</span>
            {overspent ? (
              <span className="font-semibold" style={{ color: WARN_ON_DARK }}>
                Перерасход {formatAmount(-limit.left)}
              </span>
            ) : (
              <span className="font-semibold">Осталось {formatAmount(limit.left)}</span>
            )}
          </div>
        </>
      )}
      <p className="tabular mt-3 border-t border-white/15 pt-3 text-caption text-white/75">
        Свободно {formatMoney(Math.max(0, limit.free), 'KGS')} на {days} {until}: {formatAmount(limit.startOfDay)} − {formatAmount(limit.mandatory)} обязательных.
        {!limit.income && ' Источников дохода нет.'} USDT в лимит не входит.
      </p>
    </section>
  );
}
