import { expect, test, type Page } from '@playwright/test';
import { onboard, screen } from './helpers';

/**
 * По просьбе пользователя (2026-11-09, SPEC 5.1a): экран «Главный экран» — выключатель убирает раздел с «Сегодня»,
 * ручка меняет порядок; раскладка переживает перезапуск; «Вернуть как было» — с «Отменить».
 */

/** Разделы «Сегодня» сверху вниз: подпись карточки или заголовок блока. */
const sections = (page: Page) =>
  screen(page)
    .locator('section')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? e.querySelector('h2 button > span')?.textContent ?? '').filter((n) => n !== 'Бэкап'));

/** Разделы на экране «Главный экран» по порядку ручек. */
const handles = (page: Page) =>
  page.getByRole('button', { name: /^Переместить / }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!.replace('Переместить ', '')));

async function drag(page: Page, from: string, to: string) {
  const a = (await page.getByRole('button', { name: `Переместить ${from}` }).boundingBox())!;
  const b = (await page.getByRole('button', { name: `Переместить ${to}` }).boundingBox())!;
  const x = a.x + a.width / 2;
  await page.mouse.move(x, a.y + a.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x, a.y + a.height / 2 + ((b.y - a.y) * i) / 10);
  await page.mouse.up();
}

test('«Главный экран»: раздел убирается, «Дела» — наверх, после перезапуска так же; «Вернуть как было» и «Отменить»', async ({ page }) => {
  await onboard(page);
  await expect.poll(() => sections(page)).toEqual(['Остаток', 'Счета', 'Копилка', 'Дела']);

  await screen(page).getByRole('button', { name: 'Настроить главную' }).click();
  await expect(page.getByRole('heading', { name: 'Главный экран' })).toBeVisible();
  await expect.poll(() => handles(page)).toEqual(['Остаток', 'Счета', 'Цели', 'Копилка', 'Долги', 'Лимиты', 'Ближайшие платежи', 'Дела', 'Привычки']);
  await expect(page.getByRole('button', { name: 'Вернуть как было' })).toHaveCount(0);

  const money = page.getByRole('switch', { name: 'Показывать «Остаток»' });
  await money.click();
  await expect(money).toHaveAttribute('aria-checked', 'false');
  await drag(page, 'Дела', 'Остаток');
  await expect.poll(() => handles(page)).toEqual(['Дела', 'Остаток', 'Счета', 'Цели', 'Копилка', 'Долги', 'Лимиты', 'Ближайшие платежи', 'Привычки']);

  await page.getByRole('button', { name: 'Сегодня' }).first().click();
  await expect.poll(() => sections(page)).toEqual(['Дела', 'Счета', 'Копилка']);

  // Открыли приложение заново — раскладка та же; в настройках — «8 из 9».
  await page.reload();
  await expect.poll(() => sections(page)).toEqual(['Дела', 'Счета', 'Копилка']);
  await page.getByRole('button', { name: 'Настройки' }).click();
  await expect(page.getByRole('button', { name: /Главный экран.*8 из 9/ })).toBeVisible();
  await page.getByRole('button', { name: /Главный экран/ }).click();
  await expect(page.getByRole('button', { name: 'Настройки' }).first()).toBeVisible();

  // «Вернуть как было» — порядок по умолчанию; «Отменить» возвращает выбранный.
  await page.getByRole('button', { name: 'Вернуть как было' }).click();
  await expect.poll(() => handles(page)).toEqual(['Остаток', 'Счета', 'Цели', 'Копилка', 'Долги', 'Лимиты', 'Ближайшие платежи', 'Дела', 'Привычки']);
  await expect(page.getByRole('switch', { name: 'Показывать «Остаток»' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('status').getByRole('button', { name: 'Отменить' }).click();
  await expect.poll(() => handles(page)).toEqual(['Дела', 'Остаток', 'Счета', 'Цели', 'Копилка', 'Долги', 'Лимиты', 'Ближайшие платежи', 'Привычки']);
  await expect(page.getByRole('switch', { name: 'Показывать «Остаток»' })).toHaveAttribute('aria-checked', 'false');
});
