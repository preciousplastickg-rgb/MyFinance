import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

/**
 * По просьбе пользователя (2026-11-09): в «Новой записи» у сома есть и «00», и запятая — можно записать тыйыны.
 * Клавиатура 4×4: ⌫ на две строки справа, «00» под ней, широкий 0 и запятая внизу.
 */
test('сом с тыйынами: 12,50 сом списывается до тыйына, при правке тыйыны на месте', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  await expect(d.getByRole('button', { name: '00', exact: true })).toBeVisible();
  for (const k of ['1', '2', 'Запятая', '5', '0']) await d.getByRole('button', { name: k, exact: true }).click();
  await expect(d.getByRole('button', { name: /^Сумма −12,50 сом/ })).toBeVisible();
  await d.getByRole('radio', { name: 'Кафе' }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('status')).toContainText(/Кафе −12,50\sсом/);
  await expect(page.getByRole('button', { name: /^MBank: 19\s987,50\sсом/ })).toBeVisible();

  // Правка: сумма открывается с тыйынами, «00» после запятой дописывает оба нуля только если есть место.
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await page.locator('main').getByRole('button', { name: /Кафе.*−12,50/ }).click();
  const editor = page.getByRole('dialog', { name: 'Запись' });
  await expect(editor.getByRole('button', { name: /^Сумма −12,50 сом/ })).toBeVisible();
  for (const k of ['Стереть', 'Стереть', 'Стереть', '00']) await editor.getByRole('button', { name: k, exact: true }).click();
  await expect(editor.getByRole('button', { name: /^Сумма −1\s200 сом/ })).toBeVisible();
  await editor.getByRole('button', { name: 'Сохранить' }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator('main').getByRole('button', { name: /Кафе.*−1\s200/ })).toBeVisible();
});
