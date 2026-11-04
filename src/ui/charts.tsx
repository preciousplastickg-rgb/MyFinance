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
}: {
  items: readonly { key: string; label: string; value: number; top?: string; inner?: number; bold?: boolean }[];
  height?: number;
  color?: string;
  highlight?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex items-end gap-2" style={{ height: height + 40 }}>
      {items.map((i) => {
        const h = Math.round((i.value / max) * height);
        const innerH = i.inner !== undefined ? Math.round((i.inner / max) * height) : undefined;
        const strong = i.bold || i.key === highlight;
        return (
          <div key={i.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className={`tabular text-[11px] ${strong ? 'font-bold text-ink' : 'text-muted'}`}>{i.top}</span>
            <div className="relative flex w-full max-w-10 items-end justify-center" style={{ height }}>
              <div
                className="absolute bottom-0 w-full rounded-t-md"
                style={{ height: Math.max(2, h), background: innerH !== undefined ? 'var(--line)' : color, opacity: innerH === undefined && !strong && highlight ? 0.45 : 1 }}
              />
              {innerH !== undefined && <div className="absolute bottom-0 w-full rounded-t-md" style={{ height: innerH, background: color }} />}
            </div>
            <span className={`text-[11px] ${strong ? 'font-bold text-ink' : 'text-muted'}`}>{i.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Линия прогрессии: точки по порядку, подписи первой и последней даты, минимум и максимум слева. */
export function LineChart({
  points,
  color = 'var(--accent)',
  format,
  label,
  highlight,
}: {
  points: readonly { label: string; value: number; mark?: boolean }[];
  color?: string;
  format: (v: number) => string;
  label: string;
  highlight?: boolean;
}) {
  const w = 320;
  const h = 140;
  const pad = { l: 44, r: 10, t: 12, b: 22 };
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => pad.l + (points.length === 1 ? (w - pad.l - pad.r) / 2 : (i * (w - pad.l - pad.r)) / (points.length - 1));
  const y = (v: number) => pad.t + (h - pad.t - pad.b) * (1 - (v - min) / span);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={label}>
      <line x1={pad.l} x2={w - pad.r} y1={y(max)} y2={y(max)} stroke="var(--line)" />
      <line x1={pad.l} x2={w - pad.r} y1={y(min)} y2={y(min)} stroke="var(--line)" />
      <text x={pad.l - 6} y={y(max) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
        {format(max)}
      </text>
      {max !== min && (
        <text x={pad.l - 6} y={y(min) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
          {format(min)}
        </text>
      )}
      <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={p.mark ? 5 : 3.5} fill={p.mark ? 'var(--income)' : color} stroke="var(--surface)" strokeWidth="1.5" />
      ))}
      <text x={pad.l} y={h - 4} fontSize="11" fill="var(--muted)">
        {points[0]!.label}
      </text>
      {points.length > 1 && (
        <text x={w - pad.r} y={h - 4} textAnchor="end" fontSize="11" fill={highlight ? 'var(--ink)' : 'var(--muted)'}>
          {points[points.length - 1]!.label}
        </text>
      )}
    </svg>
  );
}
