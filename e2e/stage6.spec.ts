import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('отчёт: «Куда ушли деньги», обязательные/переменные, детализация', async ({ page }) => {
  await onboard(page, { MBank: '50 000' });
  const nav = page.getByRole('navigation', { name: 'Основное меню' });
  for (const [keys, category] of [[['2', '5', '0'], 'Кафе'], [['1', '5', '00'], 'Продукты'], [['1', '5', '0', '00'], 'Жильё']] as const) {
    await nav.getByRole('button', { name: 'Новая запись' }).click();
    const d = page.getByRole('dialog', { name: 'Новая запись' });
    for (const k of keys) await d.getByRole('button', { name: k, exact: true }).click();
    await d.getByRole('radio', { name: category }).click();
    await d.getByRole('button', { name: 'Сохранить' }).click();
  }
  await nav.getByRole('button', { name: 'Отчёты' }).click();
  // 250 + 1 500 + 15 000 = 16 750. Этап 30: «Куда ушли деньги» — строки по убыванию вместо кольца и легенды.
  const rating = page.getByRole('region', { name: 'Куда ушли деньги' });
  const rows = rating.getByRole('list', { name: 'Категории расходов' }).getByRole('button');
  await expect(rows).toHaveText([/Жильё.*15\s000/, /Продукты.*1\s500/, /Кафе.*250/]);
  await expect(page.getByRole('img', { name: 'Обязательные 90%, переменные 10%' })).toBeVisible();
  await expect(page.getByText('Где можно сократить')).toHaveCount(0);

  await rating.getByRole('button', { name: /^Кафе/ }).click();
  await expect(rating).toContainText('1% всех расходов'); // 250 из 16 750
  await rating.getByRole('button', { name: 'Все операции' }).click();
  const sheet = page.getByRole('dialog', { name: 'Кафе' });
  await expect(sheet.getByText('1 операция', { exact: false })).toBeVisible();
  await expect(sheet.getByRole('button', { name: /Кафе.*−250/ })).toBeVisible();
});
