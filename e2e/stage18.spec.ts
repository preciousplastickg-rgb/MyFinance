import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers';

async function addExpense(page: Page, keys: string[], category: string) {
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  for (const k of keys) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('radio', { name: category }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(d).toHaveCount(0);
}

test('«Сегодня»: лимит раскрывается и ведёт к счёту; заголовок дня в «Деньгах» — итог дня (приёмка этапа 18)', async ({ page }) => {
  await onboard(page);
  await addExpense(page, ['3', '00'], 'Кафе');
  await page.getByLabel('Лимит на день').getByRole('button', { name: /Свободно/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Из чего лимит' });
  await expect(sheet).toContainText('Потрачено сегодня');
  await expect(sheet.getByRole('button', { name: /Кафе.*300/ })).toBeVisible();
  await sheet.getByRole('button', { name: /^MBank/ }).click();
  await expect(page.getByRole('heading', { name: 'Деньги', level: 1 })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Фильтр по счёту' }).getByRole('button', { name: 'MBank' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: /^Сегодня, .*Итог дня$/ }).click();
  await expect(page.getByLabel('Дела дня')).toBeVisible();
});

test('отчёты: операция в категории открывается, «Обязательные» и плитки дел показывают своё, привычка открывается', async ({ page }) => {
  await onboard(page);
  await addExpense(page, ['4', '00'], 'Кафе');
  await page.getByRole('navigation').getByRole('button', { name: 'Отчёты' }).click();
  await page.getByLabel('Легенда').getByRole('button', { name: /Кафе/ }).click();
  const detail = page.getByRole('dialog', { name: 'Кафе' });
  await detail.getByRole('button', { name: /Кафе.*−400/ }).click();
  await expect(page.getByRole('dialog', { name: 'Запись' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Запись' }).getByRole('button', { name: 'Отмена' }).or(page.getByRole('dialog', { name: 'Запись' }).getByRole('button', { name: 'Закрыть' })).first().click();
  await detail.getByRole('button', { name: 'Закрыть' }).first().click();

  await page.getByRole('button', { name: /^Переменные/ }).click();
  await expect(page.getByRole('dialog', { name: 'Переменные' }).getByRole('button', { name: /Кафе.*−400/ })).toBeVisible();
  await page.getByRole('dialog', { name: 'Переменные' }).getByRole('button', { name: 'Закрыть' }).first().click();

  // Дела: плитка «Сделано» открывает сделанные задачи.
  await page.getByRole('navigation').getByRole('button', { name: 'Дела' }).click();
  await page.getByLabel('Новая задача').fill('Купить воду');
  await page.getByRole('button', { name: 'Добавить задачу' }).click();
  await page.getByRole('checkbox', { name: 'Выполнить: Купить воду' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Отчёты' }).click();
  await page.getByRole('radio', { name: 'Дела' }).click();
  await page.getByRole('button', { name: 'Сделано: 1' }).click();
  await expect(page.getByRole('dialog', { name: 'Сделано' }).getByRole('button', { name: 'Купить воду, выполнено. Посмотреть' })).toBeVisible();
});
