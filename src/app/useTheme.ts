import { useEffect } from 'react';
import { animationsOf, fabPositionOf, paletteOf } from '../domain/appearance';
import type { Settings } from '../domain/types';

/** Тёмная ли тема сейчас: явный выбор или системная. */
export function isDark(theme: Settings['theme']): boolean {
  return theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

/**
 * Оформление из настроек на <html>: data-theme — всегда 'light' или 'dark' («системная» разрешается по prefers-color-scheme),
 * data-palette — тема (этап 26), data-fab — место кнопки «+» (сдвигает тост), data-motion — анимации (этап 29). Тема и палитра дублируются в localStorage
 * для inline-скрипта в index.html: тёмная тема и палитра включаются до загрузки React, без вспышки.
 */
export function useTheme(settings: Pick<Settings, 'theme' | 'palette' | 'fabPosition' | 'animations'>) {
  const { theme } = settings;
  const palette = paletteOf(settings);
  const fab = fabPositionOf(settings);
  const motion = animationsOf(settings) ? 'on' : 'off';
  useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
      localStorage.setItem('palette', palette);
      localStorage.setItem('motion', motion);
    } catch {
      // приватный режим
    }
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      root.dataset.theme = dark ? 'dark' : 'light';
      root.dataset.palette = palette;
      root.dataset.fab = fab;
      root.dataset.motion = motion;
      const color = getComputedStyle(root).getPropertyValue('--theme-color').trim();
      if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme, palette, fab, motion]);
}
