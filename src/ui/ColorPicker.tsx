import { Check } from 'lucide-react';
import { PALETTE } from '../domain/catalog';

const COLOR_NAMES: Record<string, string> = {
  '#2448D6': 'Синий', '#0B7A4B': 'Зелёный', '#B45309': 'Оранжевый', '#6D3FC4': 'Фиолетовый',
  '#0E7490': 'Бирюзовый', '#BE185D': 'Малиновый', '#172554': 'Тёмно-синий', '#5B6170': 'Серый',
};

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Цвет" className="grid grid-cols-8 gap-1">
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={COLOR_NAMES[color]}
          onClick={() => onChange(color)}
          className="flex aspect-square min-h-11 items-center justify-center"
        >
          <span
            className={`flex size-8 items-center justify-center rounded-full ${value === color ? 'ring-2 ring-offset-2 ring-offset-surface' : ''}`}
            style={{ background: color, ['--tw-ring-color' as string]: color }}
          >
            {value === color && <Check size={16} className="text-white" aria-hidden />}
          </span>
        </button>
      ))}
    </div>
  );
}
