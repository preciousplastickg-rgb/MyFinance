import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

const NOV_5 = new Date('2026-11-05T10:00:00+06:00');

async function addExpense(page: import('@playwright/test').Page, keys: string[], category: string) {
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  for (const k of keys) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('radio', { name: category }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();
}

test('вверху «Сегодня» — дата; заголовки блоков ведут в свои разделы', async ({ page }) => {
  await page.clock.setFixedTime(NOV_5);
  await onboard(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('5 ноября');
  await expect(page.getByText('Четверг', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Дела.*Все дела/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Дела');
  await page.getByRole('navigation').getByRole('button', { name: 'Сегодня' }).click();
  await page.getByRole('button', { name: /Платежи до поступления/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Регулярные');
});

test('календарь: выбрать вчера — итог дня, запись на этот день, листать дни', async ({ page }) => {
  await page.clock.setFixedTime(NOV_5);
  await onboard(page);
  await addExpense(page, ['2', '5', '0'], 'Кафе');

  await page.getByRole('button', { name: /\. Выбрать день$/ }).click();
  const cal = page.getByRole('dialog', { name: 'Выбрать день' });
  await expect(cal.getByRole('gridcell', { name: '5 ноября, сегодня, есть записи' })).toBeVisible();
  await cal.getByRole('gridcell', { name: /^4 ноября/ }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Вчера, 4 ноября');
  await expect(page.getByLabel('Деньги за день')).toContainText('Расходы0 сом');
  await page.getByRole('button', { name: 'Запись на этот день' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  await expect(d.getByRole('button', { name: 'Дата: Вчера' })).toBeVisible();
  for (const k of ['1', '0', '0']) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('radio', { name: 'Продукты' }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByLabel('Деньги за день')).toContainText('Расходы−100 сом');

  await page.getByRole('button', { name: /Следующий/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Сегодня, 5 ноября');
  await expect(page.getByLabel('Деньги за день')).toContainText('Расходы−250 сом');
  await page.getByRole('button', { name: 'Сегодня' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('5 ноября');
});

test('итог прошлого дня: привычку можно отметить задним числом', async ({ page }) => {
  await page.clock.setFixedTime(NOV_5);
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Дела' }).click();
  await page.getByRole('radio', { name: 'Привычки' }).click();
  await page.getByRole('button', { name: 'Добавить привычку' }).click();
  const editor = page.getByRole('dialog', { name: 'Новая привычка' });
  await editor.getByLabel('Шаблоны').getByRole('button', { name: 'Спортзал' }).click();
  await editor.getByLabel('Начало').fill('2026-11-01');
  await editor.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Сегодня' }).click();

  await page.getByRole('button', { name: /\. Выбрать день$/ }).click();
  await page.getByRole('dialog', { name: 'Выбрать день' }).getByRole('gridcell', { name: /^3 ноября/ }).click();
  const habits = page.getByLabel('Привычки дня');
  await habits.getByRole('button', { name: 'Отметить: Спортзал' }).click();
  await expect(habits.getByRole('button', { name: 'Снять отметку: Спортзал' })).toBeVisible();
  await expect(habits).toContainText('1 из 3 на этой неделе');
});
