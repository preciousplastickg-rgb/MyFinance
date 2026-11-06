import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('5 счетов и базовые категории переживают перезапуск', async ({ page }) => {
  await onboard(page);
  for (const name of ['MBank', 'О!Банк', 'Оптима', 'Наличные', 'USDT']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${name}:`) })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /^MBank: 20\s000\sсом/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /^MBank: 20\s000\sсом/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^USDT: 200\sUSDT/ })).toBeVisible();

  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: /Категории/ }).click();
  for (const name of ['Продукты', 'Кафе', 'Транспорт', 'Жильё', 'Связь и интернет', 'Подписки', 'Прочее']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${name}( обязательный)?$`) })).toBeVisible();
  }
  await page.getByRole('radio', { name: 'Доходы' }).click();
  for (const name of ['Зарплата', 'Подработка', 'Другое']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
});

test('новая категория со значком и цветом', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: /Категории/ }).click();
  await page.getByRole('button', { name: 'Новая категория' }).click();
  const sheet = page.getByRole('dialog', { name: 'Новая категория' });
  await sheet.getByLabel('Название').fill('Такси');
  await sheet.getByLabel('Поиск значка').fill('такс');
  await sheet.getByRole('radio', { name: 'такси' }).click();
  await sheet.getByRole('radio', { name: 'Розовый' }).click();
  await sheet.getByRole('button', { name: 'Сохранить' }).click();
  await expect(sheet).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: /Категории/ }).click();
  await expect(page.getByRole('button', { name: 'Такси', exact: true })).toBeVisible();
});

test('счёт в архив и обратно', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: /^Счета/ }).click();
  await page.getByRole('button', { name: /^Оптима/ }).click();
  await page.getByRole('button', { name: 'В архив' }).click();
  await expect(page.getByRole('heading', { name: 'Архив' })).toBeVisible();
  await page.getByRole('button', { name: 'Назад' }).or(page.getByRole('button', { name: 'Настройки' })).first().click();
  await page.getByRole('button', { name: 'Сегодня' }).first().click();
  await expect(page.getByRole('button', { name: /^Оптима:/ })).toHaveCount(0);
});
