import type { ReactNode } from 'react';

/** Кольцевая диаграмма на своём SVG, без библиотек (SPEC 2, 6). */
export function Donut({
  segments,
  size = 200,
  thickness = 26,
  children,
  label,
}: {
  segments: readonly { key: string; color: string; total: number }[];
  size?: number;
  thickness?: number;
  children?: ReactNode;
  label: string;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.total, 0);
  const gap = segments.length > 1 ? 2 : 0;
  let offset = 0;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s) => {
            const len = (s.total / total) * c;
            const dash = Math.max(0, len - gap);
            const el = (
              <circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Столбцы: светлый фон-трек и значение; подпись снизу, значение сверху. */
export function Bars({
  items,
  height = 140,
  color = 'var(--accent)',
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
            <span className={`tabular text-[11px] ${strong ? 'font-bold text-ink' : 'text-muted'}`}>{i.top}</span>
            <div className={`relative flex w-full items-end justify-center ${onPick ? 'max-w-8' : 'max-w-10'}`} style={{ height }}>
              <div
                className="absolute bottom-0 w-full rounded-t-[2px]"
                style={{ height: Math.max(2, h), background: innerH !== undefined ? 'var(--line)' : color, opacity: innerH === undefined && !strong && highlight ? 0.45 : 1 }}
              />
              {innerH !== undefined && <div className="absolute bottom-0 w-full rounded-t-[2px]" style={{ height: innerH, background: color }} />}
            </div>
            <span className={`text-[11px] ${strong ? 'font-bold text-ink' : 'text-muted'}`}>{i.label}</span>
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
