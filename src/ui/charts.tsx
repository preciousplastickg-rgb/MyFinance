import { useId, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { colorCss } from '../domain/catalog';

/**
 * Кольцевая диаграмма на своём SVG, без библиотек (SPEC 2, 6).
 * Этап 29: сектора со скруглёнными краями и зазорами на подложке-дорожке, выбранный толще и с мягким свечением своего цвета,
 * остальные бледнеют. Без анимаций: по просьбе пользователя анимированной осталась только смена темы.
 * Жест: вертикальный — прокрутка страницы (раньше touch-action: none, и экран «замерзал» под пальцем); тап — выбрать сектор
 * (повторный по выбранному — снять); палец повели вбок — выбор идёт за пальцем («лупа»).
 */
export function Donut({
  segments,
  size = 220,
  thickness = 22,
  children,
  label,
  selected,
  onSelect,
}: {
  segments: readonly { key: string; color: string; total: number; name?: string }[];
  size?: number;
  thickness?: number;
  children?: ReactNode;
  label: string;
  selected?: string;
  /** null — снять выбор. */
  onSelect?: (key: string | null) => void;
}) {
  const uid = useId().replace(/:/g, '');
  const r = (size - thickness) / 2 - 10;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.total, 0);
  const many = segments.filter((s) => s.total > 0).length > 1;
  // Зазор между секторами по дуге, px: скруглённые концы съедают по половине толщины с каждой стороны.
  const gap = many ? 5 : 0;
  const caps = many ? thickness : 0;
  const box = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number; loupe: boolean } | null>(null);

  /** Сектор под точкой экрана: по углу от центра (12 часов, по часовой), только если точка на кольце. */
  const segmentAt = (clientX: number, clientY: number, loose = false): string | undefined => {
    const el = box.current;
    if (!el || total <= 0) return undefined;
    const rect = el.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const dist = Math.hypot(dx, dy);
    if (!loose && (dist < r - thickness / 2 - 12 || dist > r + thickness / 2 + 16)) return undefined;
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;
    const target = (angle / (2 * Math.PI)) * total;
    let acc = 0;
    for (const s of segments) {
      acc += s.total;
      if (target < acc) return s.key;
    }
    return segments[segments.length - 1]?.key;
  };
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onSelect) return;
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, loupe: false };
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId || !onSelect) return;
    // Палец повели вбок — «лупа»: выбор идёт за пальцем по кольцу. Вертикально жест забирает прокрутка (pointercancel).
    if (!g.loupe && Math.abs(e.clientX - g.x) > 8 && Math.abs(e.clientX - g.x) > Math.abs(e.clientY - g.y)) {
      g.loupe = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (!g.loupe) return;
    const key = segmentAt(e.clientX, e.clientY, true);
    if (key && key !== selected) onSelect(key);
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.id !== e.pointerId || !onSelect || g.loupe || e.type === 'pointercancel') return;
    const key = segmentAt(e.clientX, e.clientY);
    if (!key) return;
    onSelect(key === selected ? null : key);
  };
  let offset = 0;
  return (
    <div
      ref={box}
      data-no-tab-swipe
      className={`relative mx-auto ${onSelect ? 'touch-pan-y select-none' : ''}`}
      style={{ width: size, height: size }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90 overflow-visible">
        <defs>
          {segments.map((s) => (
            <filter key={s.key} id={`${uid}-glow-${s.key}`} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" style={{ floodColor: colorCss(s.color) }} floodOpacity="0.55" />
            </filter>
          ))}
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sunk)" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s) => {
            const len = (s.total / total) * c;
            const dash = Math.max(0.001, len - gap - caps);
            const isSel = selected === s.key;
            const el = (
              <circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={colorCss(s.color)}
                strokeWidth={isSel ? thickness + 8 : thickness}
                strokeLinecap={many ? 'round' : 'butt'}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-(offset + (gap + caps) / 2)}
                filter={isSel ? `url(#${uid}-glow-${s.key})` : undefined}
                style={{ pointerEvents: 'none', opacity: selected && !isSel ? 0.28 : 1 }}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
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
            <span className={`tabular text-[11px] ${strong ? 'font-bold text-ink' : 'text-muted'}`}>{i.top}</span>
            <div className="relative flex w-full max-w-[34px] items-end justify-center" style={{ height }}>
              <div
                className="absolute bottom-0 w-full rounded-[10px]"
                style={{ height: Math.max(4, h), background: innerH !== undefined ? 'var(--sunk)' : color, opacity: innerH === undefined && !strong && highlight ? 0.45 : 1 }}
              />
              {innerH !== undefined && <div className="absolute bottom-0 w-full rounded-[10px]" style={{ height: innerH, background: color }} />}
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
