import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

// Приёмка этапа 23 (SPEC 4.9): лимит 6 000 у «Кафе», траты 4 200 → «4 200 из 6 000», подсказка в записи, перерасход на «Сегодня».
test('лимит по категории: редактор, блок в «Деньгах», подсказка в записи, перерасход на «Сегодня» и в отчёте', async ({ page }) => {
  await onboard(page);
  const menu = page.getByRole('navigation', { name: 'Основное меню' });

  // Лимит 6 000 у «Кафе».
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: /Категории/ }).click();
  await page.getByRole('button', { name: 'Кафе', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Категория' });
  await editor.getByLabel('Лимит в месяц (необязательно)').fill('6 000');
  await editor.getByRole('button', { name: 'Сохранить' }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Кафе 6\s000 в месяц$/ })).toBeVisible();

  // Назад в «Сегодня» (меню под экранами стека скрыто): пока трат нет, блока «Лимиты» нет.
  await page.getByRole('button', { name: 'Настройки' }).first().click();
  await page.getByRole('button', { name: 'Сегодня', exact: true }).first().click();
  await expect(page.getByRole('button', { name: /\. Выбрать день$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Лимиты' })).toHaveCount(0);

  // Расход 4 200 «Кафе»: подсказка под категорией до и после набора суммы.
  await menu.getByRole('button', { name: 'Новая запись' }).click();
  let d = page.getByRole('dialog', { name: 'Новая запись' });
  await d.getByRole('radio', { name: 'Кафе' }).click();
  await expect(d).toContainText('Кафе: Осталось 6 000 из 6 000');
  for (const k of ['4', '2', '00']) await d.getByRole('button', { name: k, exact: true }).click();
  await expect(d).toContainText('Кафе: Останется 1 800 из 6 000');
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(d).toHaveCount(0);

  // «Деньги»: блок «Лимиты» с полосой и остатком.
  await menu.getByRole('button', { name: 'Деньги' }).click();
  const limits = page.getByRole('list', { name: 'Лимиты' });
  await expect(page.getByRole('button', { name: /Свернуть лимиты/ })).toContainText('всё в рамках');
  await expect(limits.getByRole('button', { name: /^Кафе: 4\s200 из 6\s000, осталось 1\s800/ })).toBeVisible();

  // Ещё 2 500 → перерасход 700: подсказка предупреждает, блок на «Сегодня» появляется.
  await menu.getByRole('button', { name: 'Новая запись' }).click();
  d = page.getByRole('dialog', { name: 'Новая запись' });
  await d.getByRole('radio', { name: 'Кафе' }).click();
  for (const k of ['2', '5', '00']) await d.getByRole('button', { name: k, exact: true }).click();
  await expect(d).toContainText('Кафе: Превысит лимит 6 000 на 700');
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(d).toHaveCount(0);

  await menu.getByRole('button', { name: 'Сегодня' }).click();
  await expect(page.getByRole('button', { name: 'Лимиты: все в «Деньгах»' })).toContainText('1 превышен');
  await expect(page.getByRole('list', { name: 'Лимиты' }).getByRole('button', { name: /^Кафе: 6\s700 из 6\s000, перерасход 700$/ })).toBeVisible();

  // Отчёт: блок «Лимиты» и карточка «Кафе сверх лимита» без 30 дней записей; тап по ней — детализация.
  await menu.getByRole('button', { name: 'Отчёты' }).click();
  await expect(page.getByRole('list', { name: 'Лимиты по категориям' }).getByRole('button', { name: /^Кафе: 6\s700 из 6\s000/ })).toBeVisible();
  const card = page.getByRole('button', { name: /^Кафе сверх лимита/ });
  await expect(card).toContainText('+700');
  await card.click();
  await expect(page.getByRole('dialog', { name: 'Кафе' })).toContainText('2 операции');
});
