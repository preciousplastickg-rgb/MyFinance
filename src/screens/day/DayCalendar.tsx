import { ChevronLeft, ChevronRight } from '../../ui/glyphs';
import { useMemo, useState } from 'react';
import { useData } from '../../data/DataProvider';
import { activeDays, monthGrid } from '../../domain/day';
import { addMonths, formatMonthKey, formatShortDate, monthOf, parseLocalDate } from '../../domain/date';
import { Button } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Выбор дня: календарь месяца, точка — в этот день что-то было (операции, дела, привычки). */
export function DayCalendar({
  value,
  today,
  onPick,
  onClose,
}: {
  value: string;
  today: string;
  onPick: (date: string) => void;
  onClose: () => void;
}) {
  const { transactions, taskEvents, habitLogs } = useData();
  const [month, setMonth] = useState(monthOf(value));
  const grid = useMemo(() => monthGrid(month), [month]);
  const active = useMemo(() => activeDays(month, transactions, taskEvents, habitLogs), [month, transactions, taskEvents, habitLogs]);
  const pick = (d: string) => {
    onPick(d);
    onClose();
  };

  return (
    <Sheet title="Выбрать день" onClose={onClose}>
      <div className="space-y-2">
        <div className="-mt-2 flex items-center justify-between">
          <button type="button" aria-label="Предыдущий месяц" onClick={() => setMonth(addMonths(month, -1))} className="flex size-11 items-center justify-center text-muted">
            <ChevronLeft size={20} aria-hidden />
          </button>
          <p className="text-h2 font-semibold">{formatMonthKey(month)}</p>
          <button type="button" aria-label="Следующий месяц" onClick={() => setMonth(addMonths(month, 1))} className="flex size-11 items-center justify-center text-muted">
            <ChevronRight size={20} aria-hidden />
          </button>
        </div>
        <div role="grid" aria-label={formatMonthKey(month)} className="space-y-0.5">
          <div role="row" className="grid grid-cols-7 pb-1 text-center text-[12px] text-muted">
            {WEEKDAYS.map((w) => (
              <span key={w} role="columnheader">
                {w}
              </span>
            ))}
          </div>
          {grid.map((week, i) => (
            <div key={i} role="row" className="grid grid-cols-7 gap-0.5">
              {week.map((d, j) =>
                d ? (
                  <button
                    key={d}
                    type="button"
                    role="gridcell"
                    aria-selected={d === value}
                    aria-label={`${formatShortDate(d)}${d === today ? ', сегодня' : ''}${active.has(d) ? ', есть записи' : ''}`}
                    onClick={() => pick(d)}
                    className="flex h-[46px] flex-col items-center justify-center gap-0.5"
                  >
                    <span
                      className={`tabular flex size-[34px] items-center justify-center rounded-full text-body ${
                        d === today ? 'bg-primary font-bold text-on-primary' : d === value ? 'font-bold ring-[1.5px] ring-accent ring-inset' : d > today ? 'font-medium text-muted' : 'font-medium'
                      }`}
                    >
                      {parseLocalDate(d).day}
                    </span>
                    <span aria-hidden className={`size-1 rounded-full ${active.has(d) ? (d === today ? 'bg-primary' : 'bg-accent') : 'bg-transparent'}`} />
                  </button>
                ) : (
                  <span key={`e${j}`} role="gridcell" />
                ),
              )}
            </div>
          ))}
        </div>
        <p className="pt-1 text-center text-[12px] text-muted">Точка — в этот день были записи, дела или отметки привычек</p>
        {value !== today && (
          <Button variant="secondary" className="w-full" onClick={() => pick(today)}>
            Сегодня
          </Button>
        )}
      </div>
    </Sheet>
  );
}
