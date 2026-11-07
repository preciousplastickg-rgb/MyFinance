import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { ChevronDown } from '../../ui/glyphs';
import { isBase } from '../../domain/currency';
import { formatShortDate, monthShort, type MonthKey } from '../../domain/date';
import { currencyLabel, formatAmount, formatMoney, roundToSom } from '../../domain/money';
import { toKgs } from '../../domain/rate';
import type { AccountFlow, FlowLine, MonthSummary, PaceSeries } from '../../domain/reports';
import type { Id, LocalDate, Minor } from '../../domain/types';
import { CountUp } from '../../ui/charts';
import { IconCircle } from '../../ui/icons';

// Этап 22 (SPEC 6): «Итог месяца», «Темп месяца», «По счетам». Расчёты — в src/domain/reports.ts.

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const MINUS = '−';
const signed = (v: Minor) => (v > 0 ? '+' : v < 0 ? MINUS : '') + formatAmount(Math.abs(v));
/** Итог месяца — до целого сома, как плитки «Доходы / Расходы»: копейки от валютных платежей там не читаются, а Unbounded 19 не влезает в треть карточки. */
const somFmt = (v: number) => formatAmount(roundToSom(Math.round(v)));

/** false → true через два кадра после смены ключа: полосы и линии наливаются от нуля. «Уменьшить движение» — сразу true. */
function useGrown(key: string): boolean {
  const [grown, setGrown] = useState(reducedMotion);
  useEffect(() => {
    if (reducedMotion()) return setGrown(true);
    setGrown(false);
    let id = requestAnimationFrame(() => (id = requestAnimationFrame(() => setGrown(true))));
    return () => cancelAnimationFrame(id);
  }, [key]);
  return grown;
}
const tr = (grown: boolean, prop: string, i = 0, ms = 700) => (grown && !reducedMotion() ? `${prop} ${ms}ms ${EASE} ${i * 45}ms` : 'none');

export function SummaryCard({ month, s, onExpenses, onIncomes }: { month: MonthKey; s: MonthSummary; onExpenses: () => void; onIncomes: () => void }) {
  const grown = useGrown(month);
  const share = s.spentShare ?? 0;
  const vs = s.vsPrev;
  const right = s.topGrowth === undefined ? '' : s.topGrowth ? `больше всего вырос «${s.topGrowth.name}»` : 'без резких скачков';
  const col = 'min-w-0 text-left';
  // Длинная сумма — шрифтом меньше, как плитки в «Деньгах»: Unbounded 19 px не помещается в треть карточки уже на семи знаках
  // («≈ 123 456», «−123 456»), а с whitespace-nowrap вылезала бы на соседнюю колонку.
  const longest = Math.max(
    somFmt(s.expense).length + (s.expenseApprox ? 2 : 0),
    somFmt(s.income).length,
    somFmt(Math.abs(s.left)).length + (s.left < 0 ? 1 : 0),
  );
  const num = `display-num block whitespace-nowrap ${longest > 10 ? 'text-[13px]' : longest > 7 ? 'text-[15px]' : 'text-[19px]'}`;
  const approxNote = s.foreignIncome.length ? `≈ с ${s.foreignIncome.map(currencyLabel).join(', ')}` : '≈ по курсу';
  return (
    <section className="card p-4" aria-label="Итог месяца">
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={onExpenses} className={`${col} min-h-11`} aria-label={`Расходы ${formatMoney(s.expense, 'KGS')}. Открыть операции`}>
          <span className="block text-[12px] text-muted">Расходы</span>
          <span className={num}>
            {s.expenseApprox ? '≈ ' : ''}
            <CountUp key={month} value={s.expense} format={somFmt} />
          </span>
          <span className={`tabular block text-[12px] font-semibold whitespace-nowrap ${vs === undefined ? 'text-muted' : vs > 0 ? 'text-warn' : vs < 0 ? 'text-income' : 'text-muted'}`}>
            {vs === undefined ? '—' : vs === 0 ? 'как в прошлом' : `${vs > 0 ? '+' : MINUS}${Math.abs(vs)}% к ${monthShort(s.prevMonth).toLowerCase()}`}
          </span>
        </button>
        <button type="button" onClick={onIncomes} className={`${col} min-h-11 border-l border-line pl-2.5`} aria-label={`Доходы ${formatMoney(s.income, 'KGS')}. Открыть операции`}>
          <span className="block text-[12px] text-muted">Доходы</span>
          <span className={`${num} text-income`}>
            <CountUp key={month} value={s.income} format={somFmt} />
          </span>
          <span className="block text-[12px] whitespace-nowrap text-muted">{s.incomeApprox ? approxNote : ' '}</span>
        </button>
        <div className={`${col} border-l border-line pl-2.5`}>
          <span className="block text-[12px] text-muted">Осталось</span>
          <span className={`${num} ${s.left < 0 ? 'text-warn' : ''}`}>
            {s.left < 0 ? MINUS : ''}
            <CountUp key={month} value={Math.abs(s.left)} format={somFmt} />
          </span>
          <span className="tabular block text-[12px] whitespace-nowrap text-muted">{s.income > 0 ? `${Math.max(0, 100 - share)}% дохода` : ' '}</span>
        </div>
      </div>
      <div className="mt-3.5 h-2 overflow-hidden rounded-[4px] bg-sunk" role="img" aria-label={`Потрачено ${share}% дохода`}>
        <span className="block h-full rounded-[4px] bg-primary" style={{ width: grown ? `${Math.min(100, share)}%` : 0, transition: tr(grown, 'width', 0, 900) }} />
      </div>
      <div className="tabular mt-1.5 flex justify-between gap-2 text-[12px] text-muted">
        <span className="whitespace-nowrap">{s.income > 0 ? `Потрачено ${share}% дохода` : 'Доходов нет'}</span>
        <span className="min-w-0 truncate text-right">{right}</span>
      </div>
    </section>
  );
}

const W = 326;
const H = 120;

export function PaceCard({ month, p, today, onDay }: { month: MonthKey; p: PaceSeries; today: LocalDate; onDay: (date: LocalDate) => void }) {
  const grown = useGrown(month);
  // Свайп по графику листает вкладку, а не открывает день: тап — только без сдвига пальца.
  const downX = useRef<number | null>(null);
  const last = p.cumulative[p.cumulative.length - 1] ?? 0;
  if (!last) return null; // расходов в месяце нет — график пустой
  const top = Math.max(1, last, p.planAtLast !== undefined ? p.plan! : 0) * 1.08;
  const x = (d: number) => (p.days > 1 ? ((d - 1) / (p.days - 1)) * W : 0);
  const y = (v: number) => H - (v / top) * H;
  let line = `M0 ${H}`;
  let len = 0;
  let px = 0;
  let py = H;
  p.cumulative.forEach((v, i) => {
    const nx = x(i + 1);
    const ny = y(v);
    line += ` L${nx.toFixed(1)} ${ny.toFixed(1)}`;
    len += Math.hypot(nx - px, ny - py);
    px = nx;
    py = ny;
  });
  const area = `${line} L${px.toFixed(1)} ${H} Z`;
  const diff = p.diff;
  const pill =
    diff === undefined ? null : diff > 20_000 ? { text: `${signed(diff)} к обычному`, cls: 'bg-warn/12 text-warn' } : diff < -20_000 ? { text: `${signed(diff)} к обычному`, cls: 'bg-income/12 text-income' } : { text: 'как обычно', cls: 'bg-sunk text-muted' };
  const animate = !reducedMotion();
  const dayAt = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    const d = Math.round(((clientX - r.left) / r.width) * (p.days - 1)) + 1;
    return Math.max(1, Math.min(p.lastDay, d));
  };
  const open = (d: number) => onDay(`${month}-${String(d).padStart(2, '0')}`);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') open(p.lastDay);
  };
  return (
    <section className="card p-4" aria-label="Темп месяца">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Темп месяца</h2>
        {pill && <span className={`tabular rounded-full px-2.5 py-1 text-[12px] font-semibold ${pill.cls}`}>{pill.text}</span>}
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Расходы по дням: ${formatMoney(last, 'KGS')} к ${p.lastDay}-му${p.planAtLast !== undefined ? `, обычно ${formatMoney(p.planAtLast, 'KGS')}` : ''}. Открыть день`}
        onKeyDown={onKey}
        onPointerDown={(e) => (downX.current = e.clientX)}
        onClick={(e: MouseEvent<HTMLDivElement>) => {
          if (downX.current !== null && Math.abs(e.clientX - downX.current) > 10) return;
          open(dayAt(e.clientX, e.currentTarget));
        }}
        className="mt-3 cursor-pointer"
      >
        <svg viewBox={`0 0 ${W} ${H + 4}`} width="100%" height={H + 4} preserveAspectRatio="none" className="block overflow-visible" aria-hidden>
          <line x1="0" y1={H} x2={W} y2={H} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={area} fill="color-mix(in srgb, var(--primary) var(--pace-fill, 8%), transparent)" style={{ opacity: grown ? 1 : 0, transition: animate && grown ? 'opacity 600ms ease 500ms' : 'none' }} />
          {p.plan !== undefined && (
            <line x1="0" y1={H} x2={W} y2={y(p.plan)} stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          )}
          <path
            d={line}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ strokeDasharray: Math.ceil(len), strokeDashoffset: grown ? 0 : Math.ceil(len), transition: animate && grown ? `stroke-dashoffset 1100ms ${EASE}` : 'none' }}
          />
          <circle cx={px} cy={py} r="4" fill="var(--primary)" style={{ opacity: grown ? 1 : 0, transition: animate && grown ? 'opacity 300ms ease 1000ms' : 'none' }} />
        </svg>
      </div>
      <div className="tabular mt-1.5 flex items-center justify-between text-[12px] text-muted">
        <span>1</span>
        <span className="flex gap-3.5">
          <span className="flex items-center gap-1.5"><span className="h-[3px] w-3.5 rounded-sm bg-primary" />факт</span>
          {p.plan !== undefined && <span className="flex items-center gap-1.5"><span className="w-3.5 border-t-[1.5px] border-dashed border-muted" />обычный месяц</span>}
        </span>
        <span>{month === today.slice(0, 7) ? 'сегодня' : p.days}</span>
      </div>
    </section>
  );
}

export function AccountsCard({
  month,
  flows,
  to,
  rateFor,
  onLine,
}: {
  month: MonthKey;
  flows: readonly AccountFlow[];
  to: LocalDate;
  rateFor: (currency: string) => number | undefined;
  onLine: (title: string, subtitle: string, ids: readonly Id[]) => void;
}) {
  const grown = useGrown(month);
  const [open, setOpen] = useState<Id | null>(null);
  useEffect(() => setOpen(null), [month]);
  if (!flows.length) return null;
  const base = flows.filter((f) => isBase(f.account.currency));
  const foreign = flows.filter((f) => !isBase(f.account.currency));
  const max = Math.max(1, ...base.flatMap((f) => [f.inflow, f.outflow]));
  const total = base.reduce((s, f) => s + f.end, 0);
  const totalOut = base.reduce((s, f) => s + (f.lines.find((l) => l.key === 'exp')?.amount ?? 0), 0);
  const lines = (f: AccountFlow): (FlowLine & { share?: boolean })[] => {
    const exp = -(f.lines.find((l) => l.key === 'exp')?.amount ?? 0);
    const out: (FlowLine & { share?: boolean })[] = [...f.lines];
    if (exp > 0 && totalOut < 0) out.push({ key: 'share', label: 'Доля всех трат', amount: Math.round((exp * 100) / -totalOut), ids: [], share: true });
    return out;
  };
  return (
    <section className="card px-4 pt-3 pb-1" aria-label="По счетам">
      <div className="flex items-baseline justify-between gap-2 py-0.5">
        <h2 className="font-semibold">По счетам</h2>
        <span className="tabular truncate text-[12px] text-muted">остаток на {formatShortDate(to)} · {formatAmount(total)}</span>
      </div>
      <div className="flex gap-2.5 pb-1.5 text-[12px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-1 w-2.5 rounded-sm bg-income" />пришло</span>
        <span className="flex items-center gap-1.5"><span className="h-1 w-2.5 rounded-sm bg-ink" />ушло, с переводами</span>
      </div>
      <ul>
        {base.map((f, i) => {
          const d = f.end - f.start;
          const isOpen = open === f.account.id;
          return (
            <li key={f.account.id} className={i ? 'border-t border-line' : ''}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : f.account.id)}
                className="flex min-h-16 w-full items-center gap-3 py-2 text-left"
                aria-label={`${f.account.name}: остаток ${formatMoney(f.end, f.account.currency)}, за месяц ${signed(d)}, пришло ${formatAmount(f.inflow)}, ушло ${formatAmount(f.outflow)}`}
              >
                <IconCircle name={f.account.icon} color={f.account.color} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium">{f.account.name}</span>
                    <span className={`tabular text-[12px] font-semibold ${d > 0 ? 'text-income' : d < 0 ? 'text-warn' : 'text-muted'}`}>{d ? signed(d) : ''}</span>
                    <span className={`tabular min-w-16 text-right font-semibold ${f.end < 0 ? 'text-warn' : ''}`}>{formatAmount(f.end)}</span>
                  </span>
                  <span className="mt-1.5 flex flex-col gap-[3px]" aria-hidden>
                    <span className="block h-1 overflow-hidden rounded-sm bg-sunk">
                      <span className="block h-full rounded-sm bg-income" style={{ width: grown ? `${(f.inflow / max) * 100}%` : 0, transition: tr(grown, 'width', i, 800) }} />
                    </span>
                    <span className="block h-1 overflow-hidden rounded-sm bg-sunk">
                      <span className="block h-full rounded-sm bg-ink" style={{ width: grown ? `${(f.outflow / max) * 100}%` : 0, transition: tr(grown, 'width', i + 3, 800) }} />
                    </span>
                  </span>
                  <span className="tabular mt-1 flex items-center gap-1 text-[12px] text-muted">
                    пришло {formatAmount(f.inflow)} · ушло {formatAmount(f.outflow)}
                    <ChevronDown size={14} aria-hidden className={`ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </span>
                </span>
              </button>
              <div className="grid" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', transition: reducedMotion() ? 'none' : `grid-template-rows 350ms ${EASE}` }}>
                <div className="min-h-0 overflow-hidden">
                  <ul className="tabular mb-3 ml-[46px] rounded-ctl bg-sunk px-3 py-1.5 text-caption">
                    {lines(f).map((l) =>
                      l.share ? (
                        <li key={l.key} className="flex min-h-9 items-center justify-between gap-2 px-0.5">
                          <span className="text-muted">{l.label}</span>
                          <span className="font-semibold text-muted">{l.amount}%</span>
                        </li>
                      ) : (
                        <li key={l.key}>
                          <button
                            type="button"
                            tabIndex={isOpen ? 0 : -1}
                            onClick={() => onLine(`${f.account.name}: ${l.label}`, `${formatShortDate(f.startDate)} – ${formatShortDate(to)} · ${signed(l.amount)}`, l.ids)}
                            className="flex min-h-11 w-full items-center justify-between gap-2 px-0.5 text-left"
                          >
                            <span className="min-w-0 truncate text-muted">{l.label}</span>
                            <span className={`font-semibold ${l.amount > 0 ? 'text-income' : 'text-ink'}`}>{signed(l.amount)}</span>
                          </button>
                        </li>
                      ),
                    )}
                    {!f.lines.length && <li className="flex min-h-9 items-center text-muted">Движения не было</li>}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {foreign.map((f) => {
        const rate = rateFor(f.account.currency);
        const kgs = rate ? toKgs(f.end, rate) : undefined;
        return (
          <button
            key={f.account.id}
            type="button"
            onClick={() => onLine(f.account.name, `${formatShortDate(f.startDate)} – ${formatShortDate(to)}`, f.lines.flatMap((l) => l.ids))}
            className="tabular mb-3 flex w-full items-center gap-2.5 rounded-ctl bg-sunk px-3 py-2.5 text-left text-caption"
          >
            <IconCircle name={f.account.icon} color={f.account.color} size={28} dashed />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {formatMoney(f.end, f.account.currency)}
                {kgs !== undefined ? ` · ≈ ${formatMoney(kgs, 'KGS')}` : ''}
              </span>
              <span className="block text-[12px] text-muted">
                {f.account.includeInDaily ? '' : 'вне лимита · '}пришло {formatAmount(f.inflow)} · ушло {formatAmount(f.outflow)}
              </span>
            </span>
          </button>
        );
      })}
    </section>
  );
}
