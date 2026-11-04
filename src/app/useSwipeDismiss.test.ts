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
