import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('цель: создание с копилкой и делом, прогресс по формуле goalView, пополнение не трогает лимит (редизайн 2e)', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Цели' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Новая цель' }).click();
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
  await expect(entry.getByText('Перевод не считается расходом: в отчёты и расходы месяца не попадает')).toBeVisible();
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

  // На «Сегодня»: блок «Цели»; перевод в копилку — не расход: в «Деньгах» расходы месяца 0.
  await page.getByRole('button', { name: 'Цели' }).first().click();
  await page.getByRole('navigation').getByRole('button', { name: 'Сегодня' }).click();
  await expect(page.getByRole('list', { name: 'Цели' })).toContainText('Отпуск в Стамбуле');
  // Этап 25: «Цели» сворачиваются тапом по заголовку и запоминают состояние.
  await page.getByRole('button', { name: 'Свернуть цели' }).click();
  await expect(page.getByRole('list', { name: 'Цели' })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Показать цели' }).click();
  await expect(page.getByRole('list', { name: 'Цели' })).toContainText('Отпуск в Стамбуле');
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await expect(page.getByLabel('Итоги месяца')).toContainText(/Расходы0\sсом/);
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
  // На «Привычках» «+» заводит привычку (этап 28); запись — с «Сегодня».
  await page.getByRole('navigation').getByRole('button', { name: 'Сегодня' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  for (const k of ['2', '5', '0']) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('radio', { name: 'Кафе' }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Дела' }).click();
  await expect(page.getByText(/Сегодня уже 250 сом в «Кафе»/)).toBeVisible();
});
