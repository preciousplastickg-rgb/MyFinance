import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

const SW = 'dist/sw.js';

test('новая версия: плашка «Обновить» при возврате в приложение, обновление без перезапуска', async ({ page }) => {
  await onboard(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
  });
  const alert = page.getByRole('alert', { name: 'Доступна новая версия' });
  await expect(alert).toHaveCount(0);

  const original = readFileSync(SW, 'utf8');
  try {
    // На сервере появился другой sw.js — как после деплоя
    writeFileSync(SW, `${original}\n// новая версия`);
    // Возврат в приложение запускает проверку
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(alert).toBeVisible({ timeout: 15_000 });

    // «Позже» прячет плашку, при следующем открытии она снова на месте
    await alert.getByRole('button', { name: 'Позже' }).click();
    await expect(alert).toHaveCount(0);
    await page.reload();
    await expect(alert).toBeVisible({ timeout: 15_000 });

    const reloaded = page.waitForEvent('load');
    await alert.getByRole('button', { name: 'Обновить' }).click();
    await reloaded;
    await expect(page.getByRole('button', { name: /\. Выбрать день$/ })).toBeVisible();
    await expect(alert).toHaveCount(0);
    expect(await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!r?.waiting))).toBe(false);
  } finally {
    writeFileSync(SW, original);
  }
});
