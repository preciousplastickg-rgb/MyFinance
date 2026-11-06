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

test('«Новая запись» закрывается свайпом вправо', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  await expect(d).toBeVisible();
  await drag(page, { x: 30, y: 300 }, { x: 220, y: 0 });
  await expect(d).toHaveCount(0);
});

test('«Новая запись»: свайп вправо и вниз из самой формы (по категориям) закрывает; прокрученное окно вниз не закрывается', async ({ page }) => {
  await onboard(page);
  const nav = page.getByRole('navigation');
  await nav.getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  const tile = d.getByRole('radio', { name: 'Кафе' });
  let b = (await tile.boundingBox())!;
  await drag(page, { x: b.x + 10, y: b.y + b.height / 2 }, { x: 200, y: 20 });
  await expect(d).toHaveCount(0);

  await nav.getByRole('button', { name: 'Новая запись' }).click();
  b = (await tile.boundingBox())!;
  await drag(page, { x: b.x + 10, y: b.y + b.height / 2 }, { x: 0, y: 220 });
  await expect(d).toHaveCount(0);

  // Окно с длинным содержимым, прокрученное вниз: свайп вниз по содержимому — прокрутка, а не закрытие.
  await nav.getByRole('button', { name: 'Новая запись' }).click();
  await d.getByRole('button', { name: /^Счёт:/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Счёт' });
  await sheet.locator('[data-sheet-scroll]').evaluate((el) => {
    el.style.maxHeight = '120px';
    el.scrollTop = 60;
  });
  const s = (await sheet.locator('[data-sheet-scroll]').boundingBox())!;
  await drag(page, { x: s.x + s.width / 2, y: s.y + 20 }, { x: 0, y: 200 });
  await expect(sheet).toBeVisible();
});
