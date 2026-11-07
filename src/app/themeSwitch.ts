import { updateSettings } from '../data/actions';
import type { Settings } from '../domain/types';
import { reducedMotion } from './motion';
import { isDark } from './useTheme';

type ViewTransitionDoc = Document & { startViewTransition?: (update: () => Promise<void> | void) => { ready: Promise<void> } };

/**
 * Сменить светлую / тёмную тему с анимацией (этап 29). Новая тема раскрывается кругом от точки нажатия (View Transitions,
 * iOS 18+); где их нет — цвета плавно перетекают 400 мс. При выключенных анимациях — сразу.
 * data-theme ставится здесь же, не дожидаясь записи в базу и useTheme: снимок «после» нужен уже с новой темой.
 */
export async function switchTheme(theme: Settings['theme'], origin?: { x: number; y: number }): Promise<void> {
  const root = document.documentElement;
  const next = isDark(theme) ? 'dark' : 'light';
  const save = () => updateSettings({ theme });
  if (reducedMotion() || root.dataset.theme === next) return save();

  const doc = document as ViewTransitionDoc;
  if (doc.startViewTransition) {
    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? 0;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const t = doc.startViewTransition(() => {
      root.dataset.theme = next;
      void save();
    });
    await t.ready;
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 520, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', pseudoElement: '::view-transition-new(root)' },
    );
    return;
  }

  root.classList.add('theme-fade');
  root.dataset.theme = next;
  await save();
  setTimeout(() => root.classList.remove('theme-fade'), 450);
}

/** Центр элемента, по которому нажали, — оттуда раскрывается новая тема. */
export function originOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
