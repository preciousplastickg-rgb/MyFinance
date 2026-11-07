/**
 * Анимации выключены: «Уменьшить движение» в iOS или переключатель «Анимации» в настройках (этап 29, data-motion="off"
 * на <html>, ставит useTheme). CSS гасит анимации тем же селектором; здесь — для анимаций из JS (числа, кольца, доезды).
 */
export function reducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return document.documentElement.dataset.motion === 'off' || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
