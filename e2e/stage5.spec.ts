import { expect, test } from '@playwright/test';
import { setupControlExample } from './helpers';

test('контрольный пример SPEC 4.4: лимит 1 850, осталось 1 210', async ({ page }) => {
  await setupControlExample(page);
  const card = page.getByLabel('Остаток');
  await expect(card).toContainText(/1\s850\s*сом/);
  await expect(card).toContainText('потрачено 640');
  await expect(card).toContainText('осталось 1 210');
  await expect(card).toContainText('до зарплаты 6 дней');
  // Карточка остатка (этап 24): 27 600 − 640 сейчас на счетах (USDT без курса не входит), платежи до зарплаты 16 500, свободно 10 460.
  await expect(card).toContainText(/26\s960/);
  await expect(card).toContainText(/Платежи до зарплаты.*−16\s500/);
  await expect(card).toContainText(/Свободно.*10\s460\sсом/);
});

test('«Оплачено» записывает платёж, лимит не меняется', async ({ page }) => {
  await setupControlExample(page);
  await expect(page.getByText(/^Завтра · 15\s000\sсом$/)).toBeVisible();
  await page.getByRole('button', { name: 'Оплачено: Аренда квартиры' }).click();
  await expect(page.getByText('Записано')).toBeVisible();
  await expect(page.getByRole('button', { name: /^MBank: 4\s360\sсом/ })).toBeVisible();
  await expect(page.getByText('Аренда квартиры', { exact: true })).toHaveCount(0, { timeout: 4000 });
  await expect(page.getByLabel('Остаток')).toContainText(/1\s850\s*сом/);
  await expect(page.getByLabel('Остаток')).toContainText('осталось 1 210');
});

test('долгий тап по платежу — поправить сумму или пропустить', async ({ page }) => {
  await setupControlExample(page);
  await page.getByText('Интернет', { exact: true }).click({ button: 'right' });
  await page.getByRole('dialog', { name: 'Интернет' }).getByRole('button', { name: 'Пропустить' }).click();
  await expect(page.getByText('Интернет', { exact: true })).toHaveCount(0);
  // M = 15 000 + 500 → (27 600 − 15 500) / 6 = 2 016 → 2 010
  await expect(page.getByLabel('Остаток')).toContainText(/2\s010\s*сом/);
});

test('зарплата пришла раньше 17:00: «Уже пришло» записывает доход', async ({ page }) => {
  await setupControlExample(page);
  await page.clock.setFixedTime(new Date('2026-11-10T09:00:00+06:00'));
  await page.reload();
  await expect(page.getByText('Сегодня в 17:00 зачислится само · 60 000 сом')).toBeVisible();
  await page.getByRole('button', { name: 'Уже пришло: Зарплата' }).click();
  await page.getByRole('dialog', { name: 'Зарплата' }).getByRole('button', { name: 'Пришло' }).click();
  await expect(page.getByRole('button', { name: /^MBank: 79\s360\sсом/ })).toBeVisible();
  await expect(page.getByText('Сегодня в 17:00 зачислится само')).toHaveCount(0, { timeout: 4000 });
});

test('«Регулярные» из «Денег»', async ({ page }) => {
  await setupControlExample(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await page.getByRole('button', { name: 'Регулярные' }).click();
  await expect(page.getByRole('heading', { name: 'Регулярные', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Аренда квартиры.*5-го числа · ближайший 5 ноября/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Зарплата.*10-го числа/ })).toBeVisible();
});
