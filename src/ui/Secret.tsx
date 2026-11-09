import type { ReactNode } from 'react';
import { updateSettings } from '../data/actions';
import { useData } from '../data/DataProvider';
import { Eye, EyeSlash } from './glyphs';

/**
 * Скрыть суммы (по просьбе пользователя, 2026-11-09, SPEC 9d): остатки и итоги на «Сегодня», в «Деньгах», на экране
 * счёта — «••••», чтобы не видели чужие глаза. Включается глазом в шапке, запоминается в настройках (`hideAmounts`):
 * открыли приложение на людях — суммы так и скрыты. Записи истории и платежи остаются видны — по ним действуют.
 */
export const SECRET = '••••';

export function useAmountsHidden(): boolean {
  return useData().settings.hideAmounts === true;
}

/** Текст суммы или «••••», пока суммы скрыты: для подписей и aria-label, собранных строкой. */
export function useMask(): (text: string) => string {
  const hidden = useAmountsHidden();
  return (text) => (hidden ? SECRET : text);
}

/** Сумма в разметке — или «••••», пока суммы скрыты. */
export function Secret({ children }: { children: ReactNode }) {
  return useAmountsHidden() ? <span aria-label="сумма скрыта">{SECRET}</span> : <>{children}</>;
}

/** Глаз в шапке: показывает, видны ли суммы, тап — скрыть или показать. */
export function HideAmountsButton({ className = 'text-ink' }: { className?: string }) {
  const hidden = useAmountsHidden();
  return (
    <button
      type="button"
      aria-label={hidden ? 'Показать суммы' : 'Скрыть суммы'}
      aria-pressed={hidden}
      onClick={() => void updateSettings({ hideAmounts: !hidden })}
      className={`flex size-11 items-center justify-center rounded-ctl active:bg-sunk ${className}`}
    >
      {hidden ? <EyeSlash size={22} aria-hidden /> : <Eye size={22} aria-hidden />}
    </button>
  );
}
