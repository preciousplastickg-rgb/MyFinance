import { Check } from 'lucide-react';
import { colorCss, PALETTE, PALETTE_NAMES } from '../domain/catalog';

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Цвет" className="grid grid-cols-5 gap-1">
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={PALETTE_NAMES[color]}
          onClick={() => onChange(color)}
          className="flex min-h-11 items-center justify-center"
        >
          <span
            className="flex size-[30px] items-center justify-center rounded-full"
            style={{ background: colorCss(color), boxShadow: value === color ? `0 0 0 3px var(--surface), 0 0 0 5px ${colorCss(color)}` : undefined }}
          >
            {value === color && <Check size={16} className="text-white" aria-hidden />}
          </span>
        </button>
      ))}
    </div>
  );
}
