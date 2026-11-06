import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Основное меню' });

async function addExpense(page: Page, keys: string[], category: string, account?: string) {
  await nav(page).getByRole('button', { name: 'Новая запись' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая запись' });
  if (account) {
    await dialog.getByRole('button', { name: /^Счёт:/ }).click();
    await page.getByRole('dialog', { name: 'Счёт' }).getByRole('button', { name: new RegExp(`^${account}`) }).click();
  }
  for (const k of keys) await dialog.getByRole('button', { name: k, exact: true }).click();
  await dialog.getByRole('radio', { name: category }).click();
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(dialog).toHaveCount(0);
}

test('расход за 3 тапа после «+»: сумма → категория → «Сохранить»', async ({ page }) => {
  await onboard(page);
  await nav(page).getByRole('button', { name: 'Новая запись' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая запись' });
  await expect(dialog.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  await dialog.getByRole('button', { name: '5', exact: true }).click(); // 1
  await dialog.getByRole('radio', { name: 'Кафе' }).click(); // 2
  await dialog.getByRole('button', { name: 'Сохранить' }).click(); // 3
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Кафе −5 сом');
  await expect(page.getByRole('button', { name: /^MBank: 19\s995\sсом/ })).toBeVisible();
});

test('отмена из toast убирает запись', async ({ page }) => {
  await onboard(page);
  await addExpense(page, ['2', '5', '0'], 'Кафе');
  await page.getByRole('status').getByRole('button', { name: 'Отменить' }).click();
  await expect(page.getByRole('button', { name: /^MBank: 20\s000\sсом/ })).toBeVisible();
});

test('фильтр по счёту и итоги дней', async ({ page }) => {
  await onboard(page, { MBank: '20 000', Наличные: '5 000' });
  await addExpense(page, ['2', '5', '0'], 'Кафе');
  await addExpense(page, ['1', '00'], 'Транспорт', 'Наличные');
  await nav(page).getByRole('button', { name: 'Новая запись' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая запись' });
  await dialog.getByRole('radio', { name: 'Доход' }).click();
  for (const k of ['1', '000'.slice(0, 1), '00']) await dialog.getByRole('button', { name: k, exact: true }).click();
  await dialog.getByRole('radio', { name: 'Подработка' }).click();
  await dialog.getByRole('button', { name: 'Сохранить' }).click();

  await nav(page).getByRole('button', { name: 'Деньги' }).click();
  const list = page.locator('main');
  await expect(list.getByText('Сегодня,', { exact: false })).toBeVisible();
  // −250 −100 +1 000 = +650
  await expect(list.getByText(/^\+650$/)).toBeVisible();
  await expect(page.getByLabel('Итоги месяца')).toContainText('+1 000 сом');
  await expect(page.getByLabel('Итоги месяца')).toContainText('−350 сом');

  await page.getByRole('group', { name: 'Фильтр по счёту' }).getByRole('button', { name: 'Наличные' }).click();
  await expect(list.getByRole('button', { name: /Транспорт/ })).toBeVisible();
  await expect(list.getByRole('button', { name: /Кафе/ })).toHaveCount(0);
  await expect(list.getByText(/^−100$/)).toHaveCount(2); // строка и итог дня

  // Тап по карточке счёта на «Сегодня» открывает историю с фильтром
  await nav(page).getByRole('button', { name: 'Сегодня' }).click();
  await page.getByRole('button', { name: /^MBank:/ }).click();
  await expect(page.getByRole('group', { name: 'Фильтр по счёту' }).getByRole('button', { name: 'MBank' })).toHaveAttribute('aria-pressed', 'true');
  await expect(list.getByRole('button', { name: /Транспорт/ })).toHaveCount(0);
});

test('правка и удаление с отменой', async ({ page }) => {
  await onboard(page);
  await addExpense(page, ['2', '5', '0'], 'Кафе');
  await nav(page).getByRole('button', { name: 'Деньги' }).click();
  await page.locator('main').getByRole('button', { name: /Кафе/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Запись' });
  await sheet.getByRole('button', { name: 'Стереть' }).click();
  await sheet.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.locator('main').getByText('−25', { exact: true })).toHaveCount(2);

  await page.locator('main').getByRole('button', { name: /Кафе/ }).click();
  await page.getByRole('dialog', { name: 'Запись' }).getByRole('button', { name: 'Удалить запись' }).click();
  await expect(page.locator('main').getByRole('button', { name: /Кафе/ })).toHaveCount(0);
  // Тостов может быть несколько: «Отменить» у сохранения ещё висит, нам нужен последний — у удаления.
  await page.getByRole('status').last().getByRole('button', { name: 'Отменить' }).click();
  await expect(page.locator('main').getByRole('button', { name: /Кафе/ })).toBeVisible();
});

test('свайп влево удаляет', async ({ page }) => {
  await onboard(page);
  await addExpense(page, ['7', '0'], 'Кафе');
  await nav(page).getByRole('button', { name: 'Деньги' }).click();
  const row = page.locator('main').getByRole('button', { name: /Кафе/ });
  // Над историей — итоги, «Копилка», «Долги»: строка внизу экрана, её закрывает toast «Кафе −70 · Отменить».
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 10_000 });
  // Над историей теперь ещё и счета: строка может оказаться под плавающим меню — прокручиваем её в центр.
  await row.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width - 20 - i * 25, box.y + box.height / 2);
  await page.mouse.up();
  await expect(page.locator('main').getByRole('button', { name: /Кафе/ })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Запись удалена');
});
