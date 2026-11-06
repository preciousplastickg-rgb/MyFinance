import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

// Приёмка этапа 22 (SPEC 6): «Итог месяца», «Темп месяца», «По счетам» с переводами.
test('отчёт v2: итог, темп и движение по счетам; перевод не меняет расходы', async ({ page }) => {
  await onboard(page);
  const menu = page.getByRole('navigation', { name: 'Основное меню' });
  // Расход 400 «Кафе» с MBank.
  await menu.getByRole('button', { name: 'Новая запись' }).click();
  let d = page.getByRole('dialog', { name: 'Новая запись' });
  for (const k of ['4', '00']) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('radio', { name: 'Кафе' }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  // Перевод 5 000 MBank → Наличные.
  await menu.getByRole('button', { name: 'Новая запись' }).click();
  d = page.getByRole('dialog', { name: 'Новая запись' });
  await d.getByRole('radio', { name: 'Перевод' }).click();
  await d.getByRole('button', { name: /^Откуда:/ }).click();
  await page.getByRole('dialog', { name: 'Откуда' }).getByRole('button', { name: /^MBank/ }).click();
  await d.getByRole('button', { name: /^Куда:/ }).click();
  await page.getByRole('dialog', { name: 'Куда' }).getByRole('button', { name: /^Наличные/ }).click();
  for (const k of ['5', '0', '00']) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();

  await menu.getByRole('button', { name: 'Отчёты' }).click();
  // Итог: расходы 400 — перевод в них не попал.
  const summary = page.getByRole('region', { name: 'Итог месяца' });
  await expect(summary.getByRole('button', { name: /^Расходы 400\sсом/ })).toBeVisible();
  await expect(summary).toContainText('Доходов нет');
  await expect(page.getByRole('region', { name: 'Темп месяца' })).toBeVisible();
  // Свайп по графику листает вкладку, а не открывает день.
  const chart = page.getByRole('button', { name: /^Расходы по дням/ });
  const b = (await chart.boundingBox())!;
  await page.mouse.move(b.x + 40, b.y + 60);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(b.x + 40 + 22 * i, b.y + 60 + i);
  await page.mouse.up();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Цели');
  await menu.getByRole('button', { name: 'Отчёты' }).click();
  // Тап по графику — экран дня.
  await chart.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\d+ [а-я]+$/);
  await expect(page.getByRole('button', { name: /^Перевод MBank → Наличные 5\s000/ })).toBeVisible();
  await page.getByRole('button', { name: 'Сегодня', exact: true }).first().click(); // «‹ Назад» экрана дня
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Отчёты');

  // По счетам: у MBank ушло 5 400 (перевод + расход), у Наличных пришло 5 000.
  const acc = page.getByRole('region', { name: 'По счетам' });
  await acc.scrollIntoViewIfNeeded();
  await expect(acc.getByRole('button', { name: /^MBank: остаток 14\s600\sсом.*пришло 0, ушло 5\s400$/ })).toBeVisible();
  await expect(acc.getByRole('button', { name: /^Наличные: остаток 5\s000\sсом.*пришло 5\s000, ушло 0$/ })).toBeVisible();
  // Раскрытие MBank → строка перевода → её операция.
  await acc.getByRole('button', { name: /^MBank: остаток/ }).click();
  await acc.getByRole('button', { name: /^На Наличные/ }).click();
  await expect(page.getByRole('dialog', { name: 'MBank: На Наличные' })).toBeVisible();
});

test('«Уменьшить движение»: отчёт сразу с итоговыми числами', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await onboard(page);
  await page.getByRole('navigation', { name: 'Основное меню' }).getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  for (const k of ['7', '00']) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('radio', { name: 'Кафе' }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByRole('navigation', { name: 'Основное меню' }).getByRole('button', { name: 'Отчёты' }).click();
  // Без анимации число стоит сразу, не набегает.
  await expect(page.getByRole('region', { name: 'Итог месяца' })).toContainText(/Расходы700/, { timeout: 300 });
  await ctx.close();
});
