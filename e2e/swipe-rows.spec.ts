import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

// Свайп по строке истории: вправо — предыдущая вкладка (раньше строка глотала любой горизонтальный жест), влево — «Удалить».
test('вправо по записи в «Деньгах» — на «Сегодня», влево — «Удалить»; дуга до 45° засчитывается', async ({ page }) => {
  await onboard(page);
  const menu = page.getByRole('navigation', { name: 'Основное меню' });
  await menu.getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  for (const k of ['4', '00']) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('radio', { name: 'Кафе' }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await menu.getByRole('button', { name: 'Деньги' }).click();
  const row = page.locator('main').getByRole('button', { name: /^Кафе/ }).first();
  await expect(row).toBeVisible();
  // Строку закрывает toast «Кафе −400 · Отменить» и плавающее меню: ждём toast и прокручиваем строку в центр.
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 10_000 });
  const swipe = async (dx: number, dy: number) => {
    await row.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const b = (await row.boundingBox())!;
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(x + (dx * i) / 10, y + (dy * i) / 10);
    await page.mouse.up();
  };
  // Вправо по дуге (40° к горизонтали) — предыдущая вкладка.
  await swipe(120, 100);
  await expect(page.getByRole('button', { name: /\. Выбрать день$/ })).toBeVisible();
  await menu.getByRole('button', { name: 'Деньги' }).click();
  // Влево — «Удалить» у строки, вкладка на месте.
  await swipe(-100, 0);
  await expect(page.getByRole('button', { name: 'Удалить' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Деньги');
});
