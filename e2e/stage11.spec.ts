import { expect, test } from '@playwright/test';

const NOV_4 = new Date('2026-11-04T10:00:00+06:00');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOV_4);
  await page.goto('/');
  await page.getByLabel('Остаток MBank').fill('20 000');
  await page.getByRole('checkbox', { name: 'Добавить Доллары' }).click();
  await page.getByLabel('Остаток Доллары').fill('100');
  await page.getByRole('checkbox', { name: 'Добавить Евро' }).click();
  await page.getByLabel('Остаток Евро').fill('50');
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Пропустить' }).click();
  await page.getByRole('button', { name: 'Пропустить' }).click();
});

test('обмен 100 USD → 8 730 сом: курс USD 87,30; «Всего ≈» учитывает USD и EUR (приёмка этапа 11)', async ({ page }) => {
  await expect(page.getByRole('button', { name: /^Доллары: 100\sUSD/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Евро: 50\sEUR/ })).toBeVisible();
  await expect(page.getByText('USD: курса нет', { exact: false })).toBeVisible();

  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  await d.getByRole('radio', { name: 'Перевод' }).click();
  await d.getByRole('button', { name: /^Откуда:/ }).click();
  await page.getByRole('dialog', { name: 'Откуда' }).getByRole('button', { name: /^Доллары/ }).click();
  await d.getByRole('button', { name: /^Куда:/ }).click();
  await page.getByRole('dialog', { name: 'Куда' }).getByRole('button', { name: /^MBank/ }).click();
  await d.getByRole('button', { name: /^Сумма/ }).click();
  for (const k of ['1', '0', '0']) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('button', { name: /Зачислено на MBank/ }).click();
  for (const k of ['8', '7', '3', '0']) await d.getByRole('button', { name: k, exact: true }).click();
  await expect(d.getByText('Курс 87,30 сом за 1 USD')).toBeVisible();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('status')).toContainText('Перевод 100 USD → 8 730 сом');
  await expect(page.getByText(/USD 87,30 — 4 ноября · EUR: курса нет/)).toBeVisible();

  // EUR — вручную в «Курсы валют»
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: /Курсы валют/ }).click();
  await page.getByRole('button', { name: /^EUR/ }).click();
  await page.getByLabel('Сом за 1 EUR').fill('95,15');
  await page.getByRole('dialog', { name: 'Курс EUR' }).getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('button', { name: /^USD.*87,30/ })).toBeVisible();
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: 'Сегодня' }).first().click();
  // 28 730 сом + 0 USD + 50 × 95,15 = 4 757,50 → 4 758
  await expect(page.getByRole('list', { name: 'Счета' })).toContainText(/Всего\s*≈\s33\s488\sсом/);
  await expect(page.getByRole('button', { name: /^Евро:/ })).toContainText('≈ 4 758 сом');
});

test('USD → EUR без сома: кросс-курс, курсы в сомах не меняются', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  await d.getByRole('radio', { name: 'Перевод' }).click();
  await d.getByRole('button', { name: /^Откуда:/ }).click();
  await page.getByRole('dialog', { name: 'Откуда' }).getByRole('button', { name: /^Доллары/ }).click();
  await d.getByRole('button', { name: /^Куда:/ }).click();
  await page.getByRole('dialog', { name: 'Куда' }).getByRole('button', { name: /^Евро/ }).click();
  await d.getByRole('button', { name: /^Сумма/ }).click();
  for (const k of ['5', '0']) await d.getByRole('button', { name: k, exact: true }).click();
  await expect(d.getByRole('button', { name: 'Запятая' })).toBeVisible(); // у валют запятая вместо 00
  await d.getByRole('button', { name: /Зачислено на Евро/ }).click();
  for (const k of ['4', '6', 'Запятая', '5']) await d.getByRole('button', { name: k, exact: true }).click();
  await expect(d.getByText('1 USD = 0,9300 EUR')).toBeVisible();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('button', { name: /^Доллары: 50\sUSD/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Евро: 96,50\sEUR/ })).toBeVisible();
  await expect(page.getByText('USD: курса нет', { exact: false })).toBeVisible();
});

test('расход с валютного счёта: строка USD в итогах месяца', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  await d.getByRole('button', { name: /^Счёт:/ }).click();
  await page.getByRole('dialog', { name: 'Счёт' }).getByRole('button', { name: /^Доллары/ }).click();
  for (const k of ['1', '2', 'Запятая', '5']) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('radio', { name: 'Кафе' }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('status')).toContainText('Кафе −12,50 USD');
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await expect(page.getByLabel('Итоги месяца')).toContainText('USD:');
  await expect(page.locator('main').getByText('−12,50 USD')).toBeVisible();
});
