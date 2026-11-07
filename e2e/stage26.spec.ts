import { expect, test, type Locator, type Page } from '@playwright/test';
import { onboard } from './helpers';

/**
 * Приёмка этапа 26 (SPEC 9a): окно «Оформление» — тема, режим, место «+». Тема применяется сразу и переживает перезагрузку;
 * «+» справа — 5 вкладок, кнопка справа; «+» по центру — 4 вкладки, «Цели» в «Делах», вырез ровный на 375 / 390 / 430 px.
 */

async function openLook(page: Page) {
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: /^Оформление/ }).click();
  return page.getByRole('dialog', { name: 'Оформление' });
}

/** Закрыть окно и вернуться с «Настроек» на «Сегодня» (меню под экраном стека скрыто). */
async function closeLook(page: Page, look: Locator) {
  await look.getByRole('button', { name: 'Закрыть' }).click();
  await expect(look).toHaveCount(0);
  await page.getByRole('button', { name: 'Сегодня' }).click();
  await expect(page.getByRole('button', { name: /\. Выбрать день$/ })).toBeVisible();
}

const center = async (l: Locator) => {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width };
};

/** Середина выреза из пути силуэта: между концом левого плеча (H…) и началом правого (A26 … X 0). */
function notchCenter(d: string): number {
  const m = d.match(/^M32 0 H([\d.]+) .* A26 26 0 0 1 ([\d.]+) 0 H/)!;
  return (Number(m[1]) + Number(m[2])) / 2;
}

test('тема «Синий» и тёмный режим применяются сразу, переживают перезагрузку; луна в шапке работает как раньше', async ({ page }) => {
  await onboard(page);
  const html = page.locator('html');
  const themeColor = page.locator('meta[name="theme-color"]');
  await expect(html).toHaveAttribute('data-palette', 'graphite');
  await expect(html).toHaveAttribute('data-theme', 'light');

  const look = await openLook(page);
  await expect(look.getByRole('radio', { name: 'Тема Графит' })).toHaveAttribute('aria-checked', 'true');
  await look.getByRole('radio', { name: 'Тема Синий' }).click();
  await expect(html).toHaveAttribute('data-palette', 'navy');
  await expect(themeColor).toHaveAttribute('content', '#f2f6fc');
  await look.getByRole('radio', { name: 'Тёмная' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(themeColor).toHaveAttribute('content', '#080e15');
  await look.getByRole('button', { name: 'Закрыть' }).click();
  await expect(page.getByRole('button', { name: /^Оформление/ })).toContainText('Синий · тёмная');

  // Копия в localStorage — для inline-скрипта, который ставит тему и палитру до загрузки приложения.
  expect(await page.evaluate(() => [localStorage.getItem('palette'), localStorage.getItem('theme')])).toEqual(['navy', 'dark']);
  await page.reload();
  await expect(html).toHaveAttribute('data-palette', 'navy');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(themeColor).toHaveAttribute('content', '#080e15');

  // После перезагрузки открыт «Сегодня»; луна / солнце ставит явную тему, палитра остаётся.
  await page.getByRole('button', { name: 'Светлая тема' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(html).toHaveAttribute('data-palette', 'navy');
  await expect(themeColor).toHaveAttribute('content', '#f2f6fc');

  // Эспрессо — другой цвет строки состояния.
  const look2 = await openLook(page);
  await look2.getByRole('radio', { name: 'Тема Эспрессо' }).click();
  await expect(themeColor).toHaveAttribute('content', '#faf5f0');
});

test('«+» справа — 5 вкладок и кнопка справа; по центру — 4 вкладки, вырез под кнопкой, «Цели» в «Делах»', async ({ page }) => {
  await onboard(page);
  const nav = page.getByRole('navigation', { name: 'Основное меню' });
  const fab = nav.getByRole('button', { name: 'Новая запись' });
  await expect(nav.getByRole('button')).toHaveCount(6);
  expect((await center(fab)).x).toBeLessThan((await center(nav.getByRole('button', { name: 'Сегодня' }))).x);

  let look = await openLook(page);
  await look.getByRole('radio', { name: 'Кнопка «+» справа' }).click();
  await expect(look).toContainText('под большой палец правой руки');
  await closeLook(page, look);
  await expect(nav.getByRole('button')).toHaveCount(6);
  await expect(nav.getByRole('button', { name: 'Цели' })).toBeVisible();
  expect((await center(fab)).x).toBeGreaterThan((await center(nav.getByRole('button', { name: 'Отчёты' }))).x);

  look = await openLook(page);
  await look.getByRole('radio', { name: 'Кнопка «+» по центру' }).click();
  await expect(look).toContainText('«Цели» переезжают в «Дела»');
  await closeLook(page, look);
  await expect(nav.getByRole('button')).toHaveCount(5);
  await expect(nav.getByRole('button', { name: 'Цели' })).toHaveCount(0);
  const n = await center(nav);
  const f = await center(fab);
  expect(Math.abs(f.x - n.x)).toBeLessThan(1);
  const svg = nav.locator('svg[data-nav-shape]');
  await expect(svg).toHaveAttribute('viewBox', `0 0 ${Math.round(n.w)} 64`);
  expect(notchCenter((await svg.locator('path').getAttribute('d'))!)).toBeCloseTo(n.w / 2, 1);

  // «Дела» — третий раздел «Цели»; пока открыты цели, в меню активна «Дела».
  await nav.getByRole('button', { name: 'Дела' }).click();
  await page.getByRole('radio', { name: 'Цели' }).click();
  await expect(page.getByText('Пока целей нет')).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Дела' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Новая', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Новая цель' });
  await editor.getByLabel('Название цели').fill('Отпуск');
  await editor.getByRole('button', { name: 'Создать цель' }).click();
  await expect(page.getByRole('status')).toContainText('Цель «Отпуск» создана');
  await expect(page.getByRole('button', { name: /^Отпуск/ })).toBeVisible();

  // Блок «Цели» на «Сегодня» ведёт в «Дела → Цели».
  await nav.getByRole('button', { name: 'Сегодня' }).click();
  await page.getByLabel('Цели').getByRole('button', { name: 'Все цели' }).click();
  await expect(page.getByRole('heading', { name: 'Дела', level: 1 })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Цели' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: /^Отпуск/ })).toBeVisible();

  // Обратно слева: «Цели» снова своя вкладка, в «Делах» раздела «Цели» нет.
  await nav.getByRole('button', { name: 'Сегодня' }).click();
  look = await openLook(page);
  await look.getByRole('radio', { name: 'Кнопка «+» слева' }).click();
  await closeLook(page, look);
  await expect(nav.getByRole('button')).toHaveCount(6);
  await nav.getByRole('button', { name: 'Дела' }).click();
  await expect(page.getByRole('radio', { name: 'Цели' })).toHaveCount(0);
  await nav.getByRole('button', { name: 'Цели' }).click();
  await expect(page.getByRole('heading', { name: 'Цели', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Отпуск/ })).toBeVisible();
});

test('вырез под «+» ровный на ширине 375, 390 и 430 px', async ({ page }) => {
  await onboard(page);
  const look = await openLook(page);
  await look.getByRole('radio', { name: 'Кнопка «+» по центру' }).click();
  await closeLook(page, look);
  const nav = page.getByRole('navigation', { name: 'Основное меню' });
  const fab = nav.getByRole('button', { name: 'Новая запись' });
  for (const width of [375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const n = await center(nav);
    expect(n.w).toBe(width - 32);
    await expect(nav.locator('svg[data-nav-shape]')).toHaveAttribute('viewBox', `0 0 ${width - 32} 64`);
    expect(notchCenter((await nav.locator('svg[data-nav-shape] path').getAttribute('d'))!)).toBeCloseTo(n.w / 2, 1);
    expect(Math.abs((await center(fab)).x - n.x)).toBeLessThan(1);
    expect((await center(fab)).y).toBeLessThan(n.y);
  }
});
