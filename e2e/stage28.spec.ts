import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers';

/**
 * Приёмка этапа 28: «+» в меню делает то, что уместно на экране («Дела»: задача / привычка / цель, иначе — новая запись);
 * свайп в «Делах» и «Отчётах» листает разделы, с края — соседнюю вкладку; свайп в «Новой записи» листает тип, с края — закрывает.
 */
async function swipe(page: Page, dx: number, y = 560) {
  const x0 = dx < 0 ? 330 : 60;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 + (dx * i) / 10, y + i);
  await page.mouse.up();
}

test('«+»: на «Делах» — задача, привычка, цель; на «Сегодня» и в «Деньгах» — новая запись', async ({ page }) => {
  await onboard(page);
  const nav = page.getByRole('navigation', { name: 'Основное меню' });
  await expect(nav.getByRole('button', { name: 'Новая запись' })).toBeVisible();

  await nav.getByRole('button', { name: 'Дела' }).click();
  await nav.getByRole('button', { name: 'Написать задачу' }).click();
  await expect(page.getByRole('textbox', { name: 'Новая задача' })).toBeFocused();

  await page.getByRole('radio', { name: 'Привычки' }).click();
  await nav.getByRole('button', { name: 'Новая привычка' }).click();
  const habit = page.getByRole('dialog', { name: 'Новая привычка' });
  await expect(habit).toBeVisible();
  await habit.getByRole('button', { name: 'Закрыть' }).click();

  await nav.getByRole('button', { name: 'Цели' }).click();
  await nav.getByRole('button', { name: 'Новая цель' }).click();
  const goal = page.getByRole('dialog', { name: 'Новая цель' });
  await expect(goal).toBeVisible();
  await goal.getByRole('button', { name: 'Отмена' }).click();
  await expect(goal).toHaveCount(0);

  await nav.getByRole('button', { name: 'Деньги' }).click();
  await nav.getByRole('button', { name: 'Новая запись' }).click();
  await expect(page.getByRole('dialog', { name: 'Новая запись' })).toBeVisible();
});

test('свайп в «Делах»: Задачи → Привычки → (край) «Цели»; в «Отчётах»: Деньги → Дела → Привычки', async ({ page }) => {
  await onboard(page);
  const nav = page.getByRole('navigation', { name: 'Основное меню' });
  const h1 = page.getByRole('heading', { level: 1 });
  const checked = (name: string) => expect(page.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');

  await nav.getByRole('button', { name: 'Дела' }).click();
  await checked('Задачи');
  await swipe(page, -220);
  await expect(h1).toHaveText('Дела');
  await checked('Привычки');
  await swipe(page, -220);
  await expect(h1).toHaveText('Цели');
  await swipe(page, 220);
  await expect(h1).toHaveText('Дела');
  await checked('Привычки');
  await swipe(page, 220);
  await checked('Задачи');
  await swipe(page, 220);
  await expect(h1).toHaveText('Деньги');

  await nav.getByRole('button', { name: 'Отчёты' }).click();
  await checked('Деньги');
  await swipe(page, -220, 100);
  await checked('Дела');
  await swipe(page, -220, 100);
  await checked('Привычки');
  await swipe(page, -220, 100); // край обоих рядов — никуда
  await expect(h1).toHaveText('Отчёты');
  await checked('Привычки');
  await swipe(page, 220, 100);
  await checked('Дела');
});

test('свайп в «Новой записи» листает Расход → Доход → Перевод; вправо с «Расхода» — закрывает', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  const checked = (name: string) => expect(d.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');
  await checked('Расход');
  await swipe(page, -220, 300);
  await checked('Доход');
  await swipe(page, -220, 300);
  await checked('Перевод');
  await swipe(page, -220, 300);
  await checked('Перевод');
  await swipe(page, 220, 300);
  await checked('Доход');
  await swipe(page, 220, 300);
  await checked('Расход');
  await expect(d).toBeVisible();
  await swipe(page, 220, 300);
  await expect(d).toHaveCount(0);
});
