import { expect, type Page } from '@playwright/test';

/** Первый запуск: остаток на MBank и USDT, пропуск доходов и платежей. */
export async function onboard(page: Page, balances: Record<string, string> = { MBank: '20 000', USDT: '200' }) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Счета', level: 1 })).toBeVisible();
  for (const [name, value] of Object.entries(balances)) {
    await page.getByLabel(`Остаток ${name}`).fill(value);
  }
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Пропустить' }).click();
  await page.getByRole('button', { name: 'Пропустить' }).click();
  await expect(page.getByRole('heading', { name: 'Сегодня', level: 1 })).toBeVisible();
}
