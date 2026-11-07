import { Check } from '../../ui/glyphs';
import type { ReactNode } from 'react';
import { isDark } from '../../app/useTheme';
import { switchTheme } from '../../app/themeSwitch';
import { updateSettings } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import {
  FAB_HINTS, FAB_NAMES, FAB_POSITIONS, fabPositionOf, PALETTE_NAMES, PALETTES, paletteOf, type FabPosition, type Palette,
} from '../../domain/appearance';
import type { Settings } from '../../domain/types';
import { Segmented } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';

const MODE_NAMES: Record<Settings['theme'], string> = { light: 'светлая', dark: 'тёмная', system: 'как в системе' };

/** Подпись строки «Оформление» в настройках: «Графит · светлая». */
export function appearanceSummary(s: Settings): string {
  return `${PALETTE_NAMES[paletteOf(s)]} · ${MODE_NAMES[s.theme]}`;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="px-1 text-caption font-semibold text-muted">{title}</h3>
      {children}
    </section>
  );
}

/** Рамка выбранной карточки — 2 px акцент, остальных — 1 px линия (SPEC 9a). */
const ring = (on: boolean) => (on ? 'ring-2 ring-accent' : 'ring-1 ring-line');

/**
 * Мини-превью темы: элемент .theme-swatch несёт токены своей палитры (tokens.css), поэтому полосы внутри — обычные
 * bg-ink / bg-accent / bg-primary / bg-nav-bg, без hex. Режим — текущий: тёмный, если включён тёмный.
 */
function ThemeSwatch({ palette, dark }: { palette: Palette; dark: boolean }) {
  return (
    <span className="theme-swatch relative block h-[92px] overflow-hidden rounded-[14px] bg-bg ring-1 ring-line ring-inset" data-palette={palette} data-theme={dark ? 'dark' : 'light'} aria-hidden>
      <span className="absolute inset-x-2 top-2 h-[30px] rounded-[9px] bg-surface">
        <span className="absolute top-2 left-[7px] h-1.5 w-[34px] rounded-[3px] bg-ink" />
        <span className="absolute top-[18px] left-[7px] h-1 w-5 rounded-sm bg-accent" />
      </span>
      <span className="absolute top-11 left-2 h-4 w-[42%] rounded-[5px] bg-primary" />
      <span className="absolute inset-x-2 bottom-2 h-[18px] rounded-[9px] bg-nav-bg">
        <span className="absolute top-[3px] right-1 size-3 rounded-full bg-accent" />
      </span>
    </span>
  );
}

/** Схема «где кнопка»: пилюля меню и точка-кнопка на своём месте. */
function FabScheme({ position }: { position: FabPosition }) {
  const pill = position === 'left' ? 'left-7 right-1' : position === 'right' ? 'left-1 right-7' : 'inset-x-1';
  const dot = position === 'left' ? 'left-1' : position === 'right' ? 'right-1' : 'left-1/2 -ml-2';
  return (
    <span className="relative block h-[46px] w-full" aria-hidden>
      <span className={`absolute bottom-1 h-4 rounded-lg bg-primary ${pill}`} />
      <span className={`absolute bottom-1 size-4 rounded-full bg-primary ring-2 ring-surface ${dot}`} />
    </span>
  );
}

/**
 * Окно «Оформление» (этап 26, SPEC 9a): тема, режим, место кнопки «+». Всё применяется сразу, без «Сохранить»;
 * хранится в настройках, тема и палитра дублируются в localStorage (useTheme).
 */
export function AppearanceSheet({ onClose }: { onClose: () => void }) {
  const { settings } = useData();
  const palette = paletteOf(settings);
  const fab = fabPositionOf(settings);
  const dark = isDark(settings.theme);
  return (
    <Sheet title="Оформление" onClose={onClose}>
      <div className="space-y-5 pb-2">
        <p className="text-caption text-muted">Меняется сразу и запоминается на этом телефоне.</p>
        <Block title="Тема">
          <div role="radiogroup" aria-label="Тема" className="grid grid-cols-3 gap-2.5">
            {PALETTES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={p === palette}
                aria-label={`Тема ${PALETTE_NAMES[p]}`}
                onClick={() => void updateSettings({ palette: p })}
                className={`flex flex-col gap-2 rounded-[20px] p-2 text-left transition-shadow duration-150 ${ring(p === palette)}`}
              >
                <ThemeSwatch palette={p} dark={dark} />
                <span className="flex items-center gap-1.5 px-0.5 text-[13px] font-semibold">
                  <span className="min-w-0 flex-1 truncate">{PALETTE_NAMES[p]}</span>
                  {p === palette && <Check size={15} className="text-accent" aria-hidden />}
                </span>
              </button>
            ))}
          </div>
        </Block>
        <Block title="Режим">
          <Segmented
            label="Режим"
            value={settings.theme}
            onChange={(theme) => void switchTheme(theme)}
            options={[
              { value: 'light', label: 'Светлая' },
              { value: 'dark', label: 'Тёмная' },
              { value: 'system', label: 'Как в системе' },
            ]}
          />
        </Block>
        <Block title="Кнопка «+»">
          <div role="radiogroup" aria-label="Кнопка «+»" className="grid grid-cols-3 gap-2.5">
            {FAB_POSITIONS.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={f === fab}
                aria-label={`Кнопка «+» ${FAB_NAMES[f].toLowerCase()}`}
                onClick={() => void updateSettings({ fabPosition: f })}
                className={`flex flex-col items-center gap-2 rounded-[20px] px-2 py-2.5 transition-shadow duration-150 ${ring(f === fab)}`}
              >
                <FabScheme position={f} />
                <span className="text-[13px] font-semibold">{FAB_NAMES[f]}</span>
              </button>
            ))}
          </div>
          <p className="px-1 pt-1 text-[12px] text-pretty text-muted">{FAB_HINTS[fab]}</p>
        </Block>
      </div>
    </Sheet>
  );
}
