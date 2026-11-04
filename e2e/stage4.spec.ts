import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('200 USDT → 17 500 сом: курс 87,50, балансы верны, доходы и расходы месяца не изменились', async ({ page }) => {
  await onboard(page, { MBank: '10 000', USDT: '500' });
  const nav = page.getByRole('navigation', { name: 'Основное меню' });
  await nav.getByRole('button', { name: 'Новая запись' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая запись' });
  await dialog.getByRole('radio', { name: 'Перевод' }).click();
  await dialog.getByRole('button', { name: /^Откуда:/ }).click();
  await page.getByRole('dialog', { name: 'Откуда' }).getByRole('button', { name: /^USDT/ }).click();
  await expect(dialog.getByRole('button', { name: 'Куда: MBank' })).toBeVisible();
  for (const k of ['2', '0', '0']) await dialog.getByRole('button', { name: k, exact: true }).click();
  await dialog.getByRole('button', { name: /Зачислено на MBank/ }).click();
  for (const k of ['1', '7', '5', '00']) await dialog.getByRole('button', { name: k, exact: true }).click();
  await expect(dialog.getByText('Курс 87,50 сом за 1 USDT')).toBeVisible();
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('status')).toContainText('Перевод 200 USDT → 17 500 сом');

  await expect(page.getByRole('button', { name: /^MBank: 27\s500\sсом/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^USDT: 300\sUSDT/ })).toBeVisible();
  await expect(page.getByText('Курс 87,50 — ', { exact: false })).toBeVisible();
  // 27 500 + 300 × 87,50 = 53 750
  await expect(page.getByText(/Всего\s≈\s53\s750\sсом/)).toBeVisible();

  await nav.getByRole('button', { name: 'Деньги' }).click();
  await expect(page.getByLabel('Итоги месяца')).toContainText('Доходы+0 сом');
  await expect(page.getByLabel('Итоги месяца')).toContainText('Расходы−0 сом');
  await expect(page.locator('main').getByRole('button', { name: /Перевод.*USDT → MBank.*200 → 17\s500/ })).toBeVisible();

  // Следующий перевод из USDT подставляет MBank
  await nav.getByRole('button', { name: 'Новая запись' }).click();
  await dialog.getByRole('radio', { name: 'Перевод' }).click();
  await expect(dialog.getByRole('button', { name: 'Откуда: USDT' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Куда: MBank' })).toBeVisible();
});

test('перевод в одной валюте: «Зачислено» скрыто', async ({ page }) => {
  await onboard(page, { MBank: '10 000', Наличные: '0' });
  await page.getByRole('navigation', { name: 'Основное меню' }).getByRole('button', { name: 'Новая запись' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая запись' });
  await dialog.getByRole('radio', { name: 'Перевод' }).click();
  await dialog.getByRole('button', { name: /^Откуда:/ }).click();
  await page.getByRole('dialog', { name: 'Откуда' }).getByRole('button', { name: /^MBank/ }).click();
  await dialog.getByRole('button', { name: /^Куда:/ }).click();
  await page.getByRole('dialog', { name: 'Куда' }).getByRole('button', { name: /^Наличные/ }).click();
  await expect(dialog.getByText(/Зачислено/)).toHaveCount(0);
  for (const k of ['3', '000'.slice(0, 1), '00']) await dialog.getByRole('button', { name: k, exact: true }).click();
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('button', { name: /^MBank: 7\s000\sсом/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Наличные: 3\s000\sсом/ })).toBeVisible();
});

test('ручной курс в настройках', async ({ page }) => {
  await onboard(page, { MBank: '0', USDT: '100' });
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: /Курс USDT/ }).click();
  await page.getByLabel('Сом за 1 USDT').fill('88,10');
  await page.getByRole('dialog', { name: 'Курс USDT' }).getByRole('button', { name: 'Сохранить' }).click();
  await page.getByRole('button', { name: 'Сегодня' }).first().click();
  await expect(page.getByText(/Всего\s≈\s8\s810\sсом/)).toBeVisible();
});
