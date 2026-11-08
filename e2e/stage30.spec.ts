import { expect, test, type Page } from '@playwright/test';
import { addTask, NOV_4, onboard, screen } from './helpers';

/**
 * Приёмка этапа 30 (SPEC 6, 7.3): «Куда ушли деньги» вместо кольца — строки категорий раскрываются по одной, «Все операции»
 * открывают детализацию; «Отчёты → Дела» — нарастание, четыре плитки и строка выбранного дня. Без анимаций.
 */

const running = (page: Page) =>
  page.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return document.getAnimations().filter((a) => a.playState === 'running').length;
  });

async function expense(page: Page, keys: string[], category: string) {
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  for (const k of keys) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('radio', { name: category }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(d).toHaveCount(0);
}

test('«Куда ушли деньги»: тап по категории раскрывает только её, «Все операции» — детализация; кольца нет', async ({ page }) => {
  await page.clock.setFixedTime(NOV_4);
  await onboard(page);
  await expense(page, ['4', '00'], 'Кафе');
  await expense(page, ['2', '5', '0'], 'Кафе');
  await expense(page, ['1', '2', '00'], 'Продукты');
  await page.getByRole('navigation').getByRole('button', { name: 'Отчёты' }).click();
  await expect(page.getByRole('radio', { name: 'Деньги' })).toHaveAttribute('aria-checked', 'true');

  const block = screen(page).getByRole('region', { name: 'Куда ушли деньги' });
  await expect(block).toBeVisible();
  // Кольца и его выбора сектора больше нет.
  await expect(screen(page).getByRole('img', { name: /^Расходы за/ })).toHaveCount(0);
  // Строки по убыванию: Продукты 1 200, Кафе 650.
  const rows = block.getByRole('list', { name: 'Категории расходов' }).getByRole('button', { expanded: false });
  await expect(rows.first()).toContainText('Продукты');
  await expect(rows.first()).toContainText('1 200');

  const cafe = block.getByRole('button', { name: /^Кафе/ });
  await cafe.click();
  await expect(cafe).toHaveAttribute('aria-expanded', 'true');
  expect(await running(page)).toBe(0); // раскрытие — сразу, без анимации
  // 650 из 1 850 = 35%, две покупки, средний чек 325.
  await expect(block).toContainText('35% всех расходов');
  await expect(block).toContainText('2 покупки · средний чек 325');
  await expect(block.getByRole('button', { name: 'Все операции' })).toHaveCount(1);

  // Другая строка — раскрывается она, Кафе сворачивается.
  const food = block.getByRole('button', { name: /^Продукты/ });
  await food.click();
  await expect(food).toHaveAttribute('aria-expanded', 'true');
  await expect(cafe).toHaveAttribute('aria-expanded', 'false');
  await expect(block).toContainText('65% всех расходов');

  await block.getByRole('button', { name: 'Все операции' }).click();
  const detail = page.getByRole('dialog', { name: 'Продукты' });
  await expect(detail).toBeVisible();
  await expect(detail).toContainText('1 операция');
  await expect(detail.getByRole('button', { name: /^Ноябрь 2026/ })).toBeVisible(); // столбцы за 6 месяцев
});

test('«Отчёты → Дела»: нарастание, четыре плитки; тап по дню меняет строку итога, повторный — экран дня', async ({ page }) => {
  await page.clock.setFixedTime(NOV_4);
  await onboard(page);
  const nav = page.getByRole('navigation', { name: 'Основное меню' });
  await nav.getByRole('button', { name: 'Дела' }).click();
  await addTask(page, 'Позвонить маме');
  await addTask(page, 'Купить воду');
  await screen(page).getByRole('checkbox', { name: 'Выполнить: Купить воду' }).click();

  await nav.getByRole('button', { name: 'Отчёты' }).click();
  await page.getByRole('radio', { name: 'Дела' }).click();
  const card = screen(page).getByRole('region', { name: 'Нарастание дел' });
  await expect(card).toContainText('1 из 2');
  for (const [tile, value] of [['Было', '2'], ['Сделано', '1'], ['Не сделано', '0'], ['Важных', '0']] as const) {
    await expect(card.getByRole('button', { name: new RegExp(`^${tile}: ${value},`) })).toBeVisible();
  }
  const caption = card.locator('[data-burnup-caption]');
  await expect(caption).toContainText('Сегодня, 4 ноября');
  await expect(caption).toContainText('к этому дню 1 из 2 · отстаю на 1');

  // Тап по понедельнику — строка итога о нём; без анимации.
  const monday = card.getByRole('button', { name: /^Понедельник, 2 ноября/ });
  await monday.click();
  await expect(monday).toHaveAttribute('aria-pressed', 'true');
  await expect(caption).toContainText('Понедельник, 2 ноября');
  await expect(caption).toContainText('к этому дню 0 из 0');
  expect(await running(page)).toBe(0);
  // Будущий день — «запланировано».
  await card.getByRole('button', { name: /^Пятница, 6 ноября/ }).click();
  await expect(caption).toContainText('запланировано 0');

  // Повторный тап по выбранному дню — экран дня (7b).
  const today = card.getByRole('button', { name: /^Сегодня, 4 ноября/ });
  await today.click();
  await expect(caption).toContainText('Сегодня, 4 ноября');
  await today.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('4 ноября');
});
