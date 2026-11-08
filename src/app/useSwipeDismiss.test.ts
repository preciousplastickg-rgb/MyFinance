import { describe, expect, it } from 'vitest';
import { claimPullDown, dismissProgress, dismissStyles, shouldDismiss } from './useSwipeDismiss';

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

describe('тянуть окно вниз из содержимого на iPhone (этап 29)', () => {
  it('забираем касание, только если палец пошёл вниз не круче 45°', () => {
    expect(claimPullDown(0, 4)).toBe(true);
    expect(claimPullDown(3, 4)).toBe(true);
    expect(claimPullDown(5, 4)).toBe(false); // скорее вбок
    expect(claimPullDown(0, -4)).toBe(false); // вверх — прокрутка содержимого
  });
});

describe('окно за пальцем — без перерисовки React', () => {
  it('за пальцем — в своём слое, без перехода; фон светлеет по мере хода', () => {
    const st = dismissStyles(0, 240, 'drag', 390, 800);
    expect(st.sheet).toEqual({ transform: 'translate3d(0px, 240px, 0)', transition: '', willChange: 'transform' });
    expect(Number(st.backdrop.opacity)).toBeCloseTo(1 - 0.5 * 0.85);
    expect(dismissProgress(195, 0, 390, 800)).toBe(0.5);
    expect(dismissProgress(0, 2000, 390, 800)).toBe(1);
  });

  it('отпустили близко — возвращается с переходом, фон темнеет обратно; потом слой снимается', () => {
    const back = dismissStyles(0, 0, 'back', 390, 800);
    expect(back.sheet).toEqual({ transform: '', transition: 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)', willChange: 'transform' });
    expect(back.backdrop.opacity).toBe('');
    expect(dismissStyles(0, 0, 'rest', 390, 800).sheet).toEqual({ transform: '', transition: '', willChange: '' });
  });

  it('отпустили далеко — уезжает за край, фон гаснет', () => {
    const away = dismissStyles(390, 0, 'away', 390, 800);
    expect(away.sheet.transform).toBe('translate3d(390px, 0px, 0)');
    expect(away.sheet.transition).toBe('transform 260ms cubic-bezier(0.32, 0.72, 0, 1)');
    expect(away.backdrop).toEqual({ opacity: '0', transition: 'opacity 260ms ease-out' });
  });
});
