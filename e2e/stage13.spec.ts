import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('тренировок нет: на «Привычках» и в «Отчётах» ни зала, ни бассейна (приёмка этапа 13)', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Дела' }).click();
  await page.getByRole('radio', { name: 'Привычки' }).click();
  await expect(page.getByRole('button', { name: 'Добавить привычку' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Зал', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Бассейн', exact: true })).toHaveCount(0);
  await expect(page.getByText('Тренировки', { exact: true })).toHaveCount(0);

  // Шаблон «Спортзал» остаётся обычной привычкой: отметка — вручную.
  await page.getByRole('button', { name: 'Добавить привычку' }).click();
  const editor = page.getByRole('dialog', { name: 'Новая привычка' });
  await editor.getByLabel('Шаблоны').getByRole('button', { name: 'Спортзал' }).click();
  await expect(editor.getByText('Засчитывать тренировки')).toHaveCount(0);
  await editor.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByRole('button', { name: 'Отметить: Спортзал' }).click();
  await expect(page.getByText('1 из 3 на этой неделе')).toBeVisible();

  await page.getByRole('navigation').getByRole('button', { name: 'Отчёты' }).click();
  await page.getByRole('radio', { name: 'Привычки' }).click();
  await expect(page.getByText('Привычки за 30 дней')).toBeVisible();
  await expect(page.getByText('Тренажёры')).toHaveCount(0);
});
