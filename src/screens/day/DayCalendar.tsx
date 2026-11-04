import { ChevronLeft, ChevronRight } from 'lucide-react';
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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Предыдущий месяц" onClick={() => setMonth(addMonths(month, -1))} className="flex size-11 items-center justify-center text-muted">
            <ChevronLeft size={22} aria-hidden />
          </button>
          <p className="font-semibold">{formatMonthKey(month)}</p>
          <button type="button" aria-label="Следующий месяц" onClick={() => setMonth(addMonths(month, 1))} className="flex size-11 items-center justify-center text-muted">
            <ChevronRight size={22} aria-hidden />
          </button>
        </div>
        <div role="grid" aria-label={formatMonthKey(month)} className="space-y-1">
          <div role="row" className="grid grid-cols-7 text-center text-caption text-muted">
            {WEEKDAYS.map((w) => (
              <span key={w} role="columnheader">
                {w}
              </span>
            ))}
          </div>
          {grid.map((week, i) => (
            <div key={i} role="row" className="grid grid-cols-7 gap-1">
              {week.map((d, j) =>
                d ? (
                  <button
                    key={d}
                    type="button"
                    role="gridcell"
                    aria-selected={d === value}
                    aria-label={`${formatShortDate(d)}${d === today ? ', сегодня' : ''}${active.has(d) ? ', есть записи' : ''}`}
                    onClick={() => pick(d)}
                    className={`tabular relative flex h-11 flex-col items-center justify-center rounded-ctl text-body ${
                      d === value ? 'bg-primary font-semibold text-white' : d === today ? 'font-semibold text-accent ring-1 ring-accent' : 'active:bg-line'
                    }`}
                  >
                    {parseLocalDate(d).day}
                    {active.has(d) && (
                      <span aria-hidden className={`absolute bottom-1 size-1 rounded-full ${d === value ? 'bg-white' : 'bg-muted'}`} />
                    )}
                  </button>
                ) : (
                  <span key={`e${j}`} role="gridcell" />
                ),
              )}
            </div>
          ))}
        </div>
        {value !== today && (
          <Button variant="secondary" className="w-full" onClick={() => pick(today)}>
            Сегодня
          </Button>
        )}
      </div>
    </Sheet>
  );
}
