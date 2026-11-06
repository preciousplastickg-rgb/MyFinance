import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('цель: создание с копилкой и делом, прогресс по формуле goalView, пополнение не трогает лимит (редизайн 2e)', async ({ page }) => {
  await onboard(page);
  const limitBefore = await page.getByLabel('Лимит на день').textContent();
  await page.getByRole('navigation').getByRole('button', { name: 'Цели' }).click();
  await page.getByRole('button', { name: 'Новая', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Новая цель' });
  await expect(editor.getByRole('button', { name: 'Создать цель' })).toBeDisabled();
  await editor.getByLabel('Название цели').fill('Отпуск в Стамбуле');
  await editor.getByRole('switch').click();
  await editor.getByLabel('Сколько нужно').fill('100 000');
  await editor.getByLabel('Новое дело').fill('Купить билеты');
  await editor.getByLabel('Новое дело').press('Enter');
  await editor.getByRole('button', { name: 'Создать цель' }).click();
  await expect(page.getByRole('status')).toContainText('Цель «Отпуск в Стамбуле» создана');
  // Деньги 0 из 100 000, дела 0 из 1 → среднее 0%.
  await expect(page.getByRole('button', { name: /Отпуск в Стамбуле.*0%/ })).toBeVisible();

  await page.getByRole('button', { name: /^Отпуск в Стамбуле/ }).click();
  await page.getByRole('button', { name: 'Пополнить' }).click();
  const entry = page.getByRole('dialog', { name: 'Новая запись' });
  await expect(entry.getByText('Перевод не считается расходом и не уменьшает лимит')).toBeVisible();
  for (const k of ['5', '0', '0', '00']) await entry.getByRole('button', { name: k, exact: true }).click();
  await entry.getByRole('button', { name: 'Сохранить' }).click();
  // 50 000 из 100 000 = 50%, дела 0 из 1 → (0,5 + 0) / 2 = 25%.
  await expect(page.getByRole('heading', { name: 'Отпуск в Стамбуле' })).toBeVisible();
  await expect(page.getByText(/^25%$/).first()).toBeVisible();
  await expect(page.getByText(/50% · осталось 50\s000/)).toBeVisible();

  // Дело выполнено → дела 1 из 1 → (0,5 + 1) / 2 = 75%.
  await page.getByRole('checkbox', { name: 'Выполнить: Купить билеты' }).click();
  await expect(page.getByText(/^75%$/).first()).toBeVisible();

  // Снять больше остатка нельзя.
  await page.getByRole('button', { name: 'Снять' }).click();
  for (const k of ['6', '0', '0', '00']) await entry.getByRole('button', { name: k, exact: true }).click();
  await expect(entry.getByText(/В копилке 50\s000\sсом — больше снять нельзя/)).toBeVisible();
  await expect(entry.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  await entry.getByRole('button', { name: 'Отмена' }).click();

  // На «Сегодня»: блок «Цели» и лимит без изменений (перевод в копилку не трата, копилка вне лимита).
  await page.getByRole('button', { name: 'Цели' }).first().click();
  await page.getByRole('navigation').getByRole('button', { name: 'Сегодня' }).click();
  await expect(page.getByRole('list', { name: 'Цели' })).toContainText('Отпуск в Стамбуле');
  const limitAfter = await page.getByLabel('Лимит на день').textContent();
  expect(limitAfter?.replace(/\s/g, '')).not.toBe('');
  expect(limitAfter).toBe(limitBefore);
});

test('привычка «Без кафе»: трата в «Кафе» сегодня даёт предупреждение; привычка и дело ведут к одной цели', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Дела' }).click();
  await page.getByRole('radio', { name: 'Привычки' }).click();
  await page.getByRole('button', { name: 'Добавить привычку' }).click();
  const h = page.getByRole('dialog', { name: 'Новая привычка' });
  await h.getByLabel('Название').fill('Без кафе');
  await h.getByLabel('Следить за тратами в категории').selectOption({ label: 'Кафе' });
  await h.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  for (const k of ['2', '5', '0']) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('radio', { name: 'Кафе' }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText(/Сегодня уже 250 сом в «Кафе»/)).toBeVisible();
});
