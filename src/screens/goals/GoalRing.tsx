import { colorCss, tint } from '../../domain/catalog';
import { Icon } from '../../ui/icons';

/** Кольцо прогресса цели со значком в центре: 52 / 60 / 84 px (HANDOFF, «Цели»). */
export function GoalRing({ size, r, stroke, color, frac, icon, iconSize }: { size: number; r: number; stroke: number; color: string; frac: number; icon: string; iconSize: number }) {
  const c = 2 * Math.PI * r;
  const fg = colorCss(color);
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: tint(color), strokeWidth: stroke }} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ stroke: fg, strokeWidth: stroke, strokeLinecap: 'round', strokeDasharray: `${Math.max(0.001, frac * c)} ${c}`, transition: 'stroke-dasharray .35s' }}
        />
      </svg>
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ color: fg }}>
        <Icon name={icon} size={iconSize} />
      </span>
    </span>
  );
}

/** Чип цели у дела или привычки: «◎ Отпуск» в цвете цели. */
export function GoalChip({ color, name, size = 12 }: { color: string; name: string; size?: number }) {
  return (
    <span
      className="inline-flex items-center gap-[3px] rounded-full px-[7px] py-px font-semibold"
      style={{ background: tint(color), color: colorCss(color), fontSize: size }}
    >
      <Icon name="Target" size={size - 1} />
      {name}
    </span>
  );
}
