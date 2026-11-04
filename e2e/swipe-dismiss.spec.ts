import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers';

async function drag(page: Page, from: { x: number; y: number }, d: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(from.x + (d.x * i) / 10, from.y + (d.y * i) / 10);
  await page.mouse.up();
}

test('«Регулярные»: свайп вправо — назад в «Деньги»; короткий жест не закрывает', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await page.getByRole('button', { name: 'Регулярные' }).click();
  const title = page.getByRole('heading', { name: 'Регулярные', level: 1 });
  await expect(title).toBeVisible();
  await drag(page, { x: 40, y: 400 }, { x: 40, y: 0 });
  await expect(title).toBeVisible();
  await drag(page, { x: 40, y: 400 }, { x: 220, y: 0 });
  await expect(title).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Деньги', level: 1 })).toBeVisible();
});

test('настройки → счета: свайп вправо возвращает на шаг назад', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: /^Счета/ }).click();
  await expect(page.getByRole('heading', { name: 'Счета', level: 1 })).toBeVisible();
  await drag(page, { x: 40, y: 600 }, { x: 220, y: 0 });
  await expect(page.getByRole('heading', { name: 'Настройки', level: 1 })).toBeVisible();
});

test('окно закрывается свайпом вниз за шапку и вправо; вкладка под ним не листается', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Дела' }).click();
  await page.getByRole('radio', { name: 'Привычки' }).click();
  const editor = page.getByRole('dialog', { name: 'Новая привычка' });

  await page.getByRole('button', { name: 'Добавить привычку' }).click();
  await page.waitForTimeout(300); // окно доехало — координаты шапки окончательные
  const head = (await editor.getByRole('heading', { name: 'Новая привычка' }).boundingBox())!;
  await drag(page, { x: 200, y: head.y + head.height / 2 }, { x: 0, y: 300 });
  await expect(editor).toHaveCount(0);

  await page.getByRole('button', { name: 'Добавить привычку' }).click();
  await page.waitForTimeout(300);
  await drag(page, { x: 40, y: 300 }, { x: 250, y: 0 }); // мимо полей ввода — их свайп не трогает
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Дела', level: 1 })).toBeVisible();
});
