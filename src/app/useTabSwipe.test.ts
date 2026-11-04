import { describe, expect, it } from 'vitest';
import { swipeTarget } from './useTabSwipe';

describe('свайп между вкладками', () => {
  it('влево — следующая, вправо — предыдущая, на краях — никуда', () => {
    expect(swipeTarget('today', -100)).toBe('money');
    expect(swipeTarget('money', -100)).toBe('tasks');
    expect(swipeTarget('tasks', 100)).toBe('money');
    expect(swipeTarget('today', 100)).toBeNull();
    expect(swipeTarget('reports', -100)).toBeNull();
  });
});
