import { colorCss, glyphName, isEmoji } from '../domain/catalog';
import { DUOTONE } from './glyphs.gen';
import { GlyphSvg } from './glyphs';

/**
 * Значок категории, счёта, сферы, привычки или цели (этап 29): Phosphor duotone — контур и заливка 20 % цветом значка,
 * в цветном кружке выглядит объёмно. Ключ из базы: старые — имена lucide (сопоставлены в ICON_ALIASES), новые — имена Phosphor,
 * или сам эмодзи. Незнакомый ключ — «⋯».
 */
export function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  if (isEmoji(name)) {
    // Эмодзи чуть крупнее значка: у глифа есть поля внутри 256-квадрата, у эмодзи — почти нет.
    return (
      <span aria-hidden className={`inline-flex items-center justify-center leading-none ${className ?? ''}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.92) }}>
        {name}
      </span>
    );
  }
  return <GlyphSvg shapes={DUOTONE[glyphName(name)] ?? DUOTONE.DotsThree!} size={size} className={className} />;
}

/** Значок в круге: фон — цвет 13% (26% в тёмной теме), значок — цвет (класс .ic из tokens.css). */
export function IconCircle({
  name,
  color,
  size = 36,
  dashed = false,
}: {
  name: string;
  color: string;
  size?: number;
  dashed?: boolean;
}) {
  return (
    <span
      className={`ic inline-flex shrink-0 items-center justify-center rounded-full ${dashed ? 'outline-dashed outline-[1.5px] -outline-offset-[1.5px] outline-current' : ''}`}
      style={{ width: size, height: size, ['--c' as string]: colorCss(color) }}
      aria-hidden
    >
      <Icon name={name} size={Math.round(size * (isEmoji(name) ? 0.56 : 0.54))} />
    </span>
  );
}
