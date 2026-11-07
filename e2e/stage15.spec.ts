import { expect, test, type Page } from '@playwright/test';
import { showAccounts } from './helpers';

/** Первый запуск с зарплатой 60 000 сом 10-го числа на MBank. */
async function onboardWithSalary(page: Page, at: string) {
  await page.clock.setFixedTime(new Date(at));
  await page.goto('/');
  await page.getByLabel('Остаток MBank').fill('20 000');
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Добавить источник дохода' }).click();
  const sheet = page.getByRole('dialog').last();
  await sheet.getByLabel(/^Сумма/).fill('60 000');
  await sheet.getByLabel('Число месяца').selectOption('10');
  await sheet.getByRole('button', { name: 'Сохранить' }).click();
  await expect(sheet).toHaveCount(0);
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Пропустить' }).click();
  await showAccounts(page);
}

test('зарплата: до 17:00 «зачислится само», в 17:00 записывается сама и один раз', async ({ page }) => {
  await onboardWithSalary(page, '2026-11-10T10:00:00+06:00');
  await expect(page.getByText('Сегодня в 17:00 зачислится само · 60 000 сом')).toBeVisible();
  await expect(page.getByLabel('Остаток')).toContainText(/до зарплаты \d+ д/);

  await page.clock.setFixedTime(new Date('2026-11-10T17:05:00+06:00'));
  await page.reload();
  await expect(page.getByRole('status')).toContainText('Зачислено: Зарплата +60 000 сом');
  await expect(page.getByText('Сегодня в 17:00 зачислится само')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /MBank.*80 000/ })).toBeVisible();
  await page.reload(); // второй раз не зачисляется
  await showAccounts(page);
  await expect(page.getByRole('button', { name: /MBank.*80 000/ })).toBeVisible();
});

test('зарплата раньше 17:00: «Уже пришло» записывает сразу, в 17:00 повторно не зачисляется', async ({ page }) => {
  await onboardWithSalary(page, '2026-11-10T11:00:00+06:00');
  await page.getByRole('button', { name: 'Уже пришло: Зарплата' }).click();
  await page.getByRole('dialog', { name: 'Зарплата' }).getByRole('button', { name: 'Пришло' }).click();
  await expect(page.getByRole('button', { name: /MBank.*80 000/ })).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-11-10T17:30:00+06:00'));
  await page.reload();
  await showAccounts(page);
  await expect(page.getByRole('button', { name: /MBank.*80 000/ })).toBeVisible();
});

test('регулярный доход удаляется с подтверждением, «Отменить» возвращает', async ({ page }) => {
  await onboardWithSalary(page, '2026-11-04T10:00:00+06:00');
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await page.getByRole('button', { name: 'Регулярные' }).click();
  await page.getByRole('button', { name: /^Зарплата/ }).click();
  await page.getByRole('button', { name: 'Удалить' }).click();
  await page.getByRole('dialog', { name: 'Удалить «Зарплата»?' }).getByRole('button', { name: 'Удалить' }).click();
  await expect(page.getByRole('button', { name: /^Зарплата/ })).toHaveCount(0);
  await page.getByRole('status').getByRole('button', { name: 'Отменить' }).click();
  await expect(page.getByRole('button', { name: /^Зарплата/ })).toBeVisible();
});
