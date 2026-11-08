import { expect, test, type Page } from '@playwright/test';
import { onboard, settled } from './helpers';

/**
 * Приёмка этапа 28: «+» в меню делает то, что уместно на экране («Дела»: задача / привычка / цель, иначе — новая запись);
 * свайп в «Новой записи» листает тип, с края — закрывает. Свайп в «Делах» и «Отчётах» с этапа 31 — ровно одна страница ленты.
 */
/**
 * Жест — посреди экрана: на 560 px он начинался на панели разделов (её зона нажатия), и вместо свайпа был клик по разделу.
 * Переключать — дальше половины ширины: короче решает скорость пальца, а под нагрузкой Playwright отдаёт шаги с паузами.
 */
async function swipe(page: Page, dx: number, y = 450) {
  await settled(page);
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
  await nav.getByRole('button', { name: 'Новая задача' }).click();
  const task = page.getByRole('dialog', { name: 'Новая задача' });
  await expect(task.getByLabel('Название')).toBeFocused();
  await task.getByRole('button', { name: 'Закрыть' }).click();

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

test('свайп в «Делах» и «Отчётах» — ровно одна страница ленты, до половины и почти через весь экран одинаково; «+» следует за разделом (этап 31)', async ({ page }) => {
  await onboard(page);
  const nav = page.getByRole('navigation', { name: 'Основное меню' });
  const h1 = page.getByRole('heading', { level: 1 });
  const checked = (name: string) => expect(page.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');

  await nav.getByRole('button', { name: 'Дела' }).click();
  await checked('Задачи');
  await expect(nav.getByRole('button', { name: 'Новая задача' })).toBeVisible();
  await swipe(page, -230);
  await expect(h1).toHaveText('Дела');
  await checked('Привычки');
  await expect(nav.getByRole('button', { name: 'Новая привычка' })).toBeVisible();
  await swipe(page, 230);
  await checked('Задачи');
  // Почти через весь экран — тоже ровно одна страница: раздел, а не вкладка (до этапа 31 широкий листал вкладку).
  await swipe(page, -330);
  await expect(h1).toHaveText('Дела');
  await checked('Привычки');
  await swipe(page, -230);
  await expect(h1).toHaveText('Цели');
  await expect(nav.getByRole('button', { name: 'Новая цель' })).toBeVisible();
  // Свайп по шапке — как по любому месту: одна страница назад.
  await swipe(page, 230, 30);
  await expect(h1).toHaveText('Дела');
  await checked('Привычки');

  await nav.getByRole('button', { name: 'Отчёты' }).click();
  await checked('Деньги');
  await swipe(page, -230, 100);
  await checked('Дела');
  await swipe(page, -230, 100);
  await checked('Привычки');
  await swipe(page, -230, 100); // конец ленты — резинка, никуда
  await expect(h1).toHaveText('Отчёты');
  await checked('Привычки');
  await swipe(page, 330, 100);
  await checked('Дела');
});

test('тап по сегменту переключает раздел сразу, без анимации; после свайпа тоже', async ({ page }) => {
  await onboard(page);
  const nav = page.getByRole('navigation', { name: 'Основное меню' });
  // Этап 29: анимированной осталась только смена темы — через два кадра после тапа ничего не движется.
  const running = () =>
    page.evaluate(async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return document.getAnimations().filter((a) => a.playState === 'running').length;
    });
  const checked = (name: string) => expect(page.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');

  await nav.getByRole('button', { name: 'Отчёты' }).click();
  for (const name of ['Привычки', 'Деньги', 'Дела']) {
    await page.getByRole('radio', { name }).click();
    expect(await running()).toBe(0);
    await checked(name);
  }

  await swipe(page, 230, 100); // Дела → Деньги, страница доезжает за пальцем
  await checked('Деньги');
  await page.getByRole('radio', { name: 'Привычки' }).click();
  expect(await running()).toBe(0);
  await checked('Привычки');

  await nav.getByRole('button', { name: 'Дела' }).click();
  await page.getByRole('radio', { name: 'Привычки' }).click();
  expect(await running()).toBe(0);
  await checked('Привычки');
});

test('редактор цели закрывается свайпом вправо', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Цели' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Новая цель' }).click();
  const goal = page.getByRole('dialog', { name: 'Новая цель' });
  await expect(goal).toBeVisible();
  await swipe(page, 220, 400);
  await expect(goal).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Цели', level: 1 })).toBeVisible();
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
