import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Кольцевая диаграмма на своём SVG, без библиотек (SPEC 2, 6).
 * Этап 20: сектора прорисовываются по кругу один за другим при появлении и смене данных (animateKey);
 * тап по сектору — onSelect, выбранный толще, остальные бледнее. Без анимации при «Уменьшить движение».
 * «Лупа»: палец ведут по кольцу — выбор идёт за пальцем, сектор под ним увеличен. Повторный тап по выбранному — снять.
 */
export function Donut({
  segments,
  size = 200,
  thickness = 26,
  children,
  label,
  animateKey,
  selected,
  onSelect,
}: {
  segments: readonly { key: string; color: string; total: number; name?: string }[];
  size?: number;
  thickness?: number;
  children?: ReactNode;
  label: string;
  animateKey?: string;
  selected?: string;
  /** null — снять выбор. */
  onSelect?: (key: string | null) => void;
}) {
  const r = (size - thickness) / 2 - 6;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.total, 0);
  const gap = segments.length > 1 ? 2 : 0;
  const [drawn, setDrawn] = useState(reducedMotion);
  const box = useRef<HTMLDivElement>(null);
  // Жест по кольцу: где палец сейчас и двигался ли он (тап без движения по выбранному сектору снимает выбор).
  const gesture = useRef<{ id: number; moved: boolean; startKey: string | undefined; wasSelected: boolean } | null>(null);

  /** Сектор под точкой экрана: по углу от центра (12 часов, по часовой), только если точка на кольце. */
  const segmentAt = (clientX: number, clientY: number): string | undefined => {
    const el = box.current;
    if (!el || total <= 0) return undefined;
    const rect = el.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const dist = Math.hypot(dx, dy);
    if (dist < r - thickness / 2 - 10 || dist > r + thickness / 2 + 14) return undefined;
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
    const key = segmentAt(e.clientX, e.clientY);
    if (!key) return;
    // Был ли сектор выбран до нажатия: после onSelect ниже prop selected сменится ещё до pointerup.
    gesture.current = { id: e.pointerId, moved: false, startKey: key, wasSelected: key === selected };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (key !== selected) onSelect(key);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId || !onSelect) return;
    const key = segmentAt(e.clientX, e.clientY);
    if (key && key !== g.startKey) g.moved = true;
    if (key && key !== selected) onSelect(key);
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.id !== e.pointerId || !onSelect) return;
    // Тап по уже выбранному сектору без движения — снять выбор.
    if (!g.moved && g.wasSelected && segmentAt(e.clientX, e.clientY) === g.startKey && e.type !== 'pointercancel') onSelect(null);
  };
  useEffect(() => {
    if (reducedMotion()) return setDrawn(true);
    setDrawn(false);
    // Два кадра: сначала пустое кольцо, потом переход к долям — иначе браузер склеит состояния.
    let id = requestAnimationFrame(() => (id = requestAnimationFrame(() => setDrawn(true))));
    return () => cancelAnimationFrame(id);
  }, [animateKey]);
  let offset = 0;
  return (
    <div
      ref={box}
      data-no-tab-swipe
      className={`relative mx-auto ${onSelect ? 'touch-none select-none' : ''}`}
      style={{ width: size, height: size }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s, i) => {
            const len = (s.total / total) * c;
            const dash = Math.max(0, len - gap);
            const isSel = selected === s.key;
            const el = (
              <circle
                key={s.key}
                className="donut-seg"
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={isSel ? thickness + 12 : thickness}
                strokeDasharray={drawn ? `${dash} ${c - dash}` : `0 ${c}`}
                strokeDashoffset={-offset}
                style={{
                  pointerEvents: 'none',
                  opacity: selected && !isSel ? 0.35 : 1,
                  transition: `stroke-dasharray 650ms cubic-bezier(0.22, 1, 0.36, 1) ${drawn ? i * 70 : 0}ms, stroke-width 150ms ease-out, opacity 200ms ease-out`,
                }}
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

/** Число, которое набегает от прежнего значения к новому (этап 20). Без анимации при «Уменьшить движение». */
export function CountUp({ value, format, duration = 700 }: { value: number; format: (v: number) => string; duration?: number }) {
  const [shown, setShown] = useState(reducedMotion() ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reducedMotion()) return setShown(value);
    const start = performance.now();
    const a = from.current;
    let id = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(a + (value - a) * eased);
      setShown(v);
      from.current = v;
      if (t < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [value, duration]);
  return <>{format(shown)}</>;
}

export function Bars({
  items,
  height = 140,
  color = 'var(--accent)',
  highlight,
  onPick,
  pickLabel,
  animateKey,
}: {
  items: readonly { key: string; label: string; value: number; top?: string; inner?: number; bold?: boolean }[];
  height?: number;
  color?: string;
  highlight?: string;
  /** Есть — столбцы нажимаются: открыть день, месяц, неделю. */
  onPick?: (key: string) => void;
  pickLabel?: (item: { key: string; label: string; top?: string }) => string;
  /** Меняется — столбцы вырастают заново слева направо. Без анимации при «Уменьшить движение». */
  animateKey?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const [grown, setGrown] = useState(reducedMotion);
  useEffect(() => {
    if (reducedMotion()) return setGrown(true);
    setGrown(false);
    let id = requestAnimationFrame(() => (id = requestAnimationFrame(() => setGrown(true))));
    return () => cancelAnimationFrame(id);
  }, [animateKey]);
  const grow = (i: number) => ({ transition: `height 500ms cubic-bezier(0.22, 1, 0.36, 1) ${grown ? i * 40 : 0}ms` });
  return (
    // Нажимаемые столбцы стоят вплотную (зона 44 px), видимый зазор дают сами столбики шириной до 32 px.
    <div className={`flex items-end ${onPick ? '' : 'gap-2'}`} style={{ height: height + 40 }}>
      {items.map((i, idx) => {
        const h = grown ? Math.round((i.value / max) * height) : 0;
        const innerH = i.inner !== undefined ? (grown ? Math.round((i.inner / max) * height) : 0) : undefined;
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
                style={{ height: Math.max(2, h), background: innerH !== undefined ? 'var(--line)' : color, opacity: innerH === undefined && !strong && highlight ? 0.45 : 1, ...grow(idx) }}
              />
              {innerH !== undefined && <div className="absolute bottom-0 w-full rounded-t-[2px]" style={{ height: innerH, background: color, ...grow(idx) }} />}
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
