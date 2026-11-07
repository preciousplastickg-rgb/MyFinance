import { useContext, useId, useLayoutEffect, useRef } from 'react';
import { useNav } from './nav';
import { PaneActiveContext } from './SectionPager';

/**
 * Экран объявляет свои разделы, и они встают внизу, над меню (этап 29): так до них достаёт большой палец.
 * Объявляет только открытая вкладка (не соседняя, что едет рядом при свайпе). useLayoutEffect — меню появляется
 * в том же кадре, что и экран, без мигания. onChange хранится в ref: регистрация обновляется только при смене значения.
 */
export function useSubNav<T extends string>(label: string, options: readonly { value: T; label: string }[], value: T, onChange: (value: T) => void) {
  const { setSubNav } = useNav();
  const active = useContext(PaneActiveContext);
  const owner = useId();
  const ref = useRef(onChange);
  ref.current = onChange;
  const key = options.map((o) => `${o.value}:${o.label}`).join('|');
  useLayoutEffect(() => {
    if (!active) return;
    setSubNav({ owner, label, options, value, onChange: (v) => ref.current(v as T) });
    return () => setSubNav((prev) => (prev?.owner === owner ? null : prev));
    // options сравниваются по key: массив пересоздаётся каждый рендер.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, owner, label, key, value, setSubNav]);
}
