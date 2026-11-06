import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('отчёт: диаграмма, легенда, обязательные/переменные, детализация', async ({ page }) => {
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
  // 250 + 1 500 + 15 000 = 16 750
  await expect(page.getByRole('img', { name: /Расходы за .*: 16\s750\sсом/ })).toBeVisible();
  const legend = page.getByRole('list', { name: 'Легенда' });
  await expect(legend.getByRole('button')).toHaveText([/Жильё\s*15\s000/, /Продукты\s*1\s500/, /Кафе\s*250/]);
  await expect(page.getByRole('img', { name: 'Обязательные 90%, переменные 10%' })).toBeVisible();
  await expect(page.getByText('Где можно сократить')).toHaveCount(0);

  await legend.getByRole('button', { name: /Кафе/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Кафе' });
  await expect(sheet.getByText('1 операция', { exact: false })).toBeVisible();
  await expect(sheet.getByRole('button', { name: /Кафе.*−250/ })).toBeVisible();
});
