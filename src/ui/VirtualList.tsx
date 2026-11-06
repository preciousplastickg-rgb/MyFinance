import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Виртуализированный список на скролле окна: рендерятся только видимые строки (SPEC 5.3, 10 000 операций).
 * Высота каждой строки известна заранее.
 */
export function VirtualList<T>({
  items,
  height,
  render,
  getKey,
  overscan = 600,
}: {
  items: readonly T[];
  height: (item: T) => number;
  render: (item: T) => ReactNode;
  getKey: (item: T) => string;
  overscan?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ top: 0, bottom: typeof window === 'undefined' ? 1000 : window.innerHeight });

  const offsets: number[] = [];
  let total = 0;
  for (const item of items) {
    offsets.push(total);
    total += height(item);
  }

  const update = () => {
    const el = ref.current;
    if (!el) return;
    const top = -el.getBoundingClientRect().top;
    setViewport({ top: top - overscan, bottom: top + window.innerHeight + overscan });
  };
  // Обработчики прокрутки ставятся один раз; свежий update берётся из ref, а не переустанавливается на каждом рендере.
  const updateRef = useRef(update);
  updateRef.current = update;

  useLayoutEffect(update, [items.length]);
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => updateRef.current());
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // Бинарный поиск первой видимой строки.
  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid]! + height(items[mid]!) < viewport.top) lo = mid + 1;
    else hi = mid;
  }
  const visible: number[] = [];
  for (let i = lo; i < items.length && offsets[i]! <= viewport.bottom; i++) visible.push(i);

  return (
    <div ref={ref} className="relative" style={{ height: total }}>
      {visible.map((i) => (
        <div key={getKey(items[i]!)} className="absolute inset-x-0" style={{ top: offsets[i], height: height(items[i]!) }}>
          {render(items[i]!)}
        </div>
      ))}
    </div>
  );
}
