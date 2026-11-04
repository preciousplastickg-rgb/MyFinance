import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers';

const NOV_4 = new Date('2026-11-04T10:00:00+06:00');

async function fillSets(page: Page, sets: [string, string][]) {
  const dialog = page.getByRole('dialog', { name: 'Зал' });
  for (let i = 0; i < sets.length; i++) {
    if (i > 0 && (await dialog.getByLabel(`Вес, подход ${i + 1}`).count()) === 0) await dialog.getByRole('button', { name: 'Добавить подход' }).click();
    await dialog.getByLabel(`Вес, подход ${i + 1}`).fill(sets[i]![0]);
    await dialog.getByLabel(`Повторы, подход ${i + 1}`).fill(sets[i]![1]);
  }
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOV_4);
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Дела' }).click();
  await page.getByRole('radio', { name: 'Привычки' }).click();
});

test('зал: 3 × 10 × 40 кг → объём 1 200 кг, максимум ≈ 53,3 кг; «Спортзал 3 раза» отмечается сам; рекорд', async ({ page }) => {
  await page.getByRole('button', { name: 'Добавить привычку' }).click();
  const editor = page.getByRole('dialog', { name: 'Новая привычка' });
  await editor.getByLabel('Шаблоны').getByRole('button', { name: 'Спортзал' }).click();
  await editor.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('0 из 3 на этой неделе')).toBeVisible();

  await page.getByRole('button', { name: 'Зал', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Зал' });
  await expect(dialog.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Тренажёр' }).click();
  await page.getByRole('dialog', { name: 'Тренажёр' }).getByRole('button', { name: 'Жим ногами' }).click();
  await expect(dialog).toContainText('Первый раз на этом тренажёре');
  await fillSets(page, [['40', '10'], ['40', '10'], ['40', '10']]);
  await expect(dialog).toContainText('макс. ≈ 53,3 кг');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('status')).toContainText('Тренировка записана');
  await expect(page.getByRole('list', { name: 'Последние тренировки' })).toContainText('1 тренажёр · 3 подх. · 1 200 кг');
  await expect(page.getByText('1 из 3 на этой неделе')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Снять отметку: Спортзал' })).toHaveAttribute('aria-pressed', 'true');

  // Следующая тренировка: подставлен прошлый раз, рост веса — «Рекорд».
  await page.clock.setFixedTime(new Date('2026-11-06T10:00:00+06:00'));
  await page.getByRole('button', { name: 'Зал', exact: true }).click();
  await dialog.getByRole('button', { name: 'Тренажёр' }).click();
  await page.getByRole('dialog', { name: 'Тренажёр' }).getByRole('button', { name: 'Жим ногами' }).click();
  await expect(dialog).toContainText('Прошлый раз: 3 × 10 × 40 кг');
  await expect(dialog.getByLabel('Вес, подход 3')).toHaveValue('40');
  await dialog.getByLabel('Вес, подход 1').fill('45');
  await expect(dialog.getByText('Рекорд')).toBeVisible();
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('status')).toContainText('Рекорд: Жим ногами');

  await page.getByRole('button', { name: /Прогресс/ }).click();
  await expect(page.getByRole('img', { name: /Жим ногами: расчётный максимум/ })).toBeVisible();
  await expect(page.getByText('≈ 60 кг')).toBeVisible(); // 45 × 40 / 30
});

test('бассейн: 1 000 м за 32:00 → темп 3:12', async ({ page }) => {
  await page.getByRole('button', { name: 'Бассейн', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Бассейн' });
  await dialog.getByRole('button', { name: '1 000' }).click();
  await dialog.getByLabel('Время, мм:сс').fill('32:00');
  await expect(dialog).toContainText('Темп 3:12 на 100 м');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('list', { name: 'Последние тренировки' })).toContainText('1 000 м · 32:00 · 3:12 / 100 м');
  await page.getByRole('button', { name: /Прогресс/ }).click();
  await expect(page.getByText('3:12 / 100 м')).toBeVisible();
});

test('правка и удаление тренировки с отменой', async ({ page }) => {
  await page.getByRole('button', { name: 'Бассейн', exact: true }).click();
  await page.getByRole('dialog', { name: 'Бассейн' }).getByLabel('Дистанция, м').fill('800');
  await page.getByRole('dialog', { name: 'Бассейн' }).getByRole('button', { name: 'Сохранить' }).click();
  const list = page.getByRole('list', { name: 'Последние тренировки' });
  await list.getByRole('button').first().click();
  await page.getByRole('dialog', { name: 'Бассейн' }).getByRole('button', { name: 'Удалить' }).click();
  await expect(list).toHaveCount(0);
  await page.getByRole('status').getByRole('button', { name: 'Отменить' }).click();
  await expect(page.getByRole('list', { name: 'Последние тренировки' })).toContainText('800 м');
});
