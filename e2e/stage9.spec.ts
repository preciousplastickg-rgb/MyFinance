import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers';

const NOV_4 = new Date('2026-11-04T10:00:00+06:00');

async function addFromTemplate(page: Page, template: string) {
  await page.getByRole('button', { name: 'Добавить привычку' }).click();
  const sheet = page.getByRole('dialog', { name: 'Новая привычка' });
  await sheet.getByLabel('Шаблоны').getByRole('button', { name: template }).click();
  await sheet.getByRole('button', { name: 'Сохранить' }).click();
  await expect(sheet).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOV_4);
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Дела' }).click();
  await page.getByRole('radio', { name: 'Привычки' }).click();
});

test('«Вода 8 стаканов»: 8 × «+1» засчитывают день (приёмка этапа 9)', async ({ page }) => {
  await addFromTemplate(page, 'Вода');
  const plus = page.getByRole('button', { name: 'Плюс один: Вода' });
  for (let i = 0; i < 7; i++) await plus.click();
  await expect(page.getByText('7 / 8 стаканов')).toBeVisible();
  await plus.click();
  await expect(page.getByText('8 / 8 стаканов')).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Сегодня' }).click();
  await expect(page.getByRole('button', { name: '1 из 1 сегодня' })).toBeVisible();
});

test('да/нет: отметка за сегодня, правка прошлых дней в календаре, серия', async ({ page }) => {
  await addFromTemplate(page, 'Медитация');
  await expect(page.getByText('Начните серию сегодня')).toBeVisible();
  await page.getByRole('button', { name: 'Отметить: Медитация' }).click();
  await expect(page.getByText('Серия 1 день')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Снять отметку: Медитация' })).toHaveAttribute('aria-pressed', 'true');
  // Привычка начата сегодня — вчера в календаре недоступно; сдвинем старт и отметим вчера.
  await page.getByRole('button', { name: /^Медитация/ }).click();
  await page.getByRole('button', { name: 'Изменить привычку' }).click();
  await page.getByLabel('Начало').fill('2026-11-01');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByRole('button', { name: /^Медитация/ }).click();
  const detail = page.getByRole('dialog', { name: 'Медитация' });
  await detail.getByRole('button', { name: '3 ноября: не выполнено' }).click();
  await expect(detail.getByLabel('Серия: 2 дня')).toBeVisible();
});

test('дни без…: срыв с подтверждением обнуляет счётчик', async ({ page }) => {
  await addFromTemplate(page, 'Без сахара');
  await expect(page.getByText('0 дней без')).toBeVisible(); // начата сегодня
  await page.getByRole('button', { name: 'Ещё: Без сахара' }).click();
  await page.getByRole('dialog', { name: 'Без сахара' }).getByRole('button', { name: 'Да, был срыв' }).click();
  await page.getByRole('button', { name: 'Ещё: Без сахара' }).click();
  await expect(page.getByRole('dialog', { name: 'Без сахара' })).toContainText('отмечен срыв');
});

test('N раз в неделю и отчёт', async ({ page }) => {
  await addFromTemplate(page, 'Спортзал');
  await page.getByRole('button', { name: 'Отметить: Спортзал' }).click();
  await expect(page.getByText('1 из 3 на этой неделе')).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Отчёты' }).click();
  await page.getByRole('radio', { name: 'Привычки' }).click();
  await expect(page.getByText('Привычки за 30 дней')).toBeVisible();
  await expect(page.getByText('Спортзал')).toBeVisible();
});
