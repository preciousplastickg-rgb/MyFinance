import { Delete } from './glyphs';

/**
 * Своя цифровая клавиатура 4×4: клавиши 52 px, --sunk, радиус 16 (HANDOFF, «Новая запись»). На невысоком экране — 44.
 * По просьбе пользователя (2026-11-09) в любой валюте и «00», и запятая для тыйынов и центов:
 *   1 2 3 ⌫     ⌫ — на две строки
 *   4 5 6 ⌫
 *   7 8 9 00
 *   ──0── ,     0 — на три столбца
 * Сетка одна для всех валют — клавиши не перескакивают при смене валюты.
 */
export function Keypad({ onKey }: { onKey: (key: string) => void }) {
  const keys = ['1', '2', '3', 'back', '4', '5', '6', '7', '8', '9', '00', '0', ','];
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          aria-label={k === 'back' ? 'Стереть' : k === ',' ? 'Запятая' : k}
          className={`tabular flex items-center justify-center rounded-ctl bg-sunk text-num-l font-medium text-ink active:bg-line ${
            k === 'back' ? 'row-span-2' : 'h-[52px] [@media(max-height:740px)]:h-11'
          } ${k === '0' ? 'col-span-3' : ''}`}
        >
          {k === 'back' ? <Delete size={22} aria-hidden /> : k}
        </button>
      ))}
    </div>
  );
}
