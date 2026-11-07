import { useContext, useEffect, useRef } from 'react';
import { useNav } from './nav';
import { PaneActiveContext } from './SectionPager';

/**
 * Экран объявляет, что делает «+» в меню, пока он открыт (этап 28): «Задачи» — фокус в поле новой задачи,
 * «Привычки» — новая привычка, «Цели» — новая цель. Без объявления «+» открывает новую запись.
 * run хранится в ref: регистрация обновляется только при смене подписи, иначе каждый рендер дёргал бы контекст.
 */
export function useAddAction(label: string, run: () => void) {
  const { setAddAction } = useNav();
  const active = useContext(PaneActiveContext);
  const ref = useRef(run);
  ref.current = run;
  useEffect(() => {
    // Соседняя панель во время свайпа тоже смонтирована, но «+» принадлежит открытой.
    if (!active) return;
    setAddAction({ label, run: () => ref.current() });
    return () => setAddAction(null);
  }, [label, active, setAddAction]);
}
