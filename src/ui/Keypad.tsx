import { Delete } from 'lucide-react';
import { isBase } from '../domain/currency';
import type { Currency } from '../domain/types';

/** Своя цифровая клавиатура 3×4, системную не вызываем (SPEC 5.2). */
export function Keypad({ currency, onKey }: { currency: Currency; onKey: (key: string) => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', isBase(currency) ? '00' : ',', '0', 'back'];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          aria-label={k === 'back' ? 'Стереть' : k === ',' ? 'Запятая' : k}
          className="tabular flex h-[52px] items-center justify-center rounded-ctl bg-surface text-[22px] font-medium text-ink active:bg-line"
        >
          {k === 'back' ? <Delete size={24} aria-hidden /> : k}
        </button>
      ))}
    </div>
  );
}
