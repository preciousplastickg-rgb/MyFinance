import { expect, test } from '@playwright/test';

test('открывается «Сегодня» с нижним меню', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Сегодня' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Основное меню' });
  await expect(nav.getByRole('button', { name: 'Сегодня' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('button', { name: 'Деньги' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Новая запись' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Отчёты' })).toBeVisible();
  // «Дела» скрыты до фазы 2
  await expect(nav.getByRole('button', { name: 'Дела' })).toHaveCount(0);
});

test('вкладки, «+» и настройки переключаются', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Основное меню' });

  await nav.getByRole('button', { name: 'Деньги' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Деньги' })).toBeVisible();

  await nav.getByRole('button', { name: 'Отчёты' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Отчёты' })).toBeVisible();

  await nav.getByRole('button', { name: 'Новая запись' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая запись' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Отмена' }).click();
  await expect(dialog).toHaveCount(0);

  await nav.getByRole('button', { name: 'Сегодня' }).click();
  await page.getByRole('button', { name: 'Настройки' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Настройки' })).toBeVisible();
  await expect(page.getByText('v1')).toBeVisible();
});

test('все кнопки не меньше 44×44', async ({ page }) => {
  await page.goto('/');
  for (const button of await page.getByRole('button').all()) {
    const box = await button.boundingBox();
    const name = (await button.getAttribute('aria-label')) ?? (await button.textContent());
    expect(box, name ?? '').not.toBeNull();
    expect(box!.width, `${name}: ширина`).toBeGreaterThanOrEqual(44);
    expect(box!.height, `${name}: высота`).toBeGreaterThanOrEqual(44);
  }
});

test('manifest для установки на экран «Домой»', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(new URL(href!, page.url()).href)).json();
  expect(manifest.display).toBe('standalone');
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain('180x180');
  expect(sizes).toContain('512x512');
  for (const icon of manifest.icons) {
    const res = await request.get(new URL(icon.src, page.url()).href);
    expect(res.ok(), icon.src).toBe(true);
  }
  const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await request.get(new URL(touchIcon!, page.url()).href)).ok()).toBe(true);
});

test('открывается без сети после первого визита', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      );
    }
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Сегодня' })).toBeVisible();
  // Шрифт тоже из кэша
  expect(await page.evaluate(() => document.fonts.check('600 17px "IBM Plex Sans"', 'Ж'))).toBe(true);
});
