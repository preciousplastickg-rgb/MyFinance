import type { ReactNode } from 'react';

/**
 * Спарклайн (этап 30): расходы категории за 6 месяцев в раскрытой строке «Куда ушли деньги» — линия цветом категории
 * от минимума до максимума и точка на выбранном (последнем) месяце. Свой SVG, без библиотек и без анимаций.
 */
export function Sparkline({ values, color, width = 112, height = 40, label }: { values: readonly number[]; color: string; width?: number; height?: number; label: string }) {
  const pad = 4;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const pts = values.map((v, i) => [pad + (i * (width - 2 * pad)) / Math.max(1, values.length - 1), height - pad - ((v - min) / span) * (height - 2 * pad)] as const);
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="shrink-0 overflow-visible">
      <polyline points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {last && <circle cx={last[0]} cy={last[1]} r={3.5} fill={color} />}
    </svg>
  );
}

export function Bars({
  items,
  height = 140,
  color = 'var(--primary)',
  highlight,
  onPick,
  pickLabel,
}: {
  items: readonly { key: string; label: string; value: number; top?: string; inner?: number; bold?: boolean }[];
  height?: number;
  color?: string;
  highlight?: string;
  /** Есть — столбцы нажимаются: открыть день, месяц, неделю. */
  onPick?: (key: string) => void;
  pickLabel?: (item: { key: string; label: string; top?: string }) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    // Нажимаемые столбцы стоят вплотную (зона 44 px), видимый зазор дают сами столбики шириной до 32 px.
    <div className={`flex items-end ${onPick ? '' : 'gap-2'}`} style={{ height: height + 40 }}>
      {items.map((i) => {
        const h = Math.round((i.value / max) * height);
        const innerH = i.inner !== undefined ? Math.round((i.inner / max) * height) : undefined;
        const strong = i.bold || i.key === highlight;
        return (
          <Column
            key={i.key}
            onClick={onPick ? () => onPick(i.key) : undefined}
            label={onPick ? (pickLabel?.(i) ?? `${i.label}: ${i.top ?? i.value}`) : undefined}
          >
            <span className={`tabular text-micro ${strong ? 'font-semibold text-ink' : 'text-muted'}`}>{i.top}</span>
            <div className="relative flex w-full max-w-[34px] items-end justify-center" style={{ height }}>
              <div
                className="absolute bottom-0 w-full rounded-[10px]"
                style={{ height: Math.max(4, h), background: innerH !== undefined ? 'var(--sunk)' : color, opacity: innerH === undefined && !strong && highlight ? 0.45 : 1 }}
              />
              {innerH !== undefined && <div className="absolute bottom-0 w-full rounded-[10px]" style={{ height: innerH, background: color }} />}
            </div>
            <span className={`text-micro ${strong ? 'font-semibold text-ink' : 'text-muted'}`}>{i.label}</span>
          </Column>
        );
      })}
    </div>
  );
}

function Column({ children, onClick, label }: { children: ReactNode; onClick?: () => void; label?: string }) {
  const cls = 'flex min-w-0 flex-1 flex-col items-center gap-1';
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={label} className={`${cls} min-w-11 rounded-ctl active:bg-bg`}>
      {children}
    </button>
  ) : (
    <div className={cls}>{children}</div>
  );
}
