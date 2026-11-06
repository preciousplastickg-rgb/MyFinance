import { describe, expect, it } from 'vitest';
import { shouldDismiss } from './useSwipeDismiss';

describe('смахнуть, чтобы закрыть', () => {
  it('далеко — закрывает, близко — нет', () => {
    expect(shouldDismiss(120, 600)).toBe(true);
    expect(shouldDismiss(60, 600)).toBe(false);
  });
  it('быстрый короткий рывок закрывает, совсем короткий — нет', () => {
    expect(shouldDismiss(40, 150)).toBe(true);
    expect(shouldDismiss(20, 100)).toBe(false);
  });
});

describe('быстрый рывок после паузы', () => {
  it('закрывает по скорости последних 100 мс, даже если весь жест длился долго', async () => {
    const { shouldDismiss: f } = await import('./useSwipeDismiss');
    expect(f(40, 900, 0.6)).toBe(true);
    expect(f(40, 900, 0.2)).toBe(false);
  });
});
