import { Delete } from 'lucide-react';
import { isBase } from '../domain/currency';
import type { Currency } from '../domain/types';

/** Своя цифровая клавиатура 3×4: клавиши 52 px, --sunk, радиус 16 (HANDOFF, «Новая запись»). На невысоком экране — 44. */
export function Keypad({ currency, onKey }: { currency: Currency; onKey: (key: string) => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', isBase(currency) ? '00' : ',', '0', 'back'];
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          aria-label={k === 'back' ? 'Стереть' : k === ',' ? 'Запятая' : k}
          className="tabular flex h-[52px] items-center [@media(max-height:740px)]:h-11 justify-center rounded-ctl bg-sunk text-[22px] font-medium text-ink active:bg-line"
        >
          {k === 'back' ? <Delete size={22} aria-hidden /> : k}
        </button>
      ))}
    </div>
  );
}
