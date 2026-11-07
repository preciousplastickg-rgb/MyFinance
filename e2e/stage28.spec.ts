import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers';

/**
 * Приёмка этапа 28: «+» в меню делает то, что уместно на экране («Дела»: задача / привычка / цель, иначе — новая запись);
 * короткий свайп в «Делах» и «Отчётах» листает разделы, широкий — вкладку; свайп в «Новой записи» листает тип, с края — закрывает.
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

test('свайп в «Делах»: короткий листает Задачи → Привычки, широкий — вкладку; в «Отчётах» так же', async ({ page }) => {
  await onboard(page);
  const nav = page.getByRole('navigation', { name: 'Основное меню' });
  const h1 = page.getByRole('heading', { level: 1 });
  const checked = (name: string) => expect(page.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');

  await nav.getByRole('button', { name: 'Дела' }).click();
  await checked('Задачи');
  await swipe(page, -120); // короткий — раздел
  await expect(h1).toHaveText('Дела');
  await checked('Привычки');
  await swipe(page, 120);
  await checked('Задачи');
  await swipe(page, -120);
  await checked('Привычки');
  await swipe(page, -120); // с края раздела короткий свайп листает вкладку
  await expect(h1).toHaveText('Цели');
  await nav.getByRole('button', { name: 'Дела' }).click();
  await checked('Привычки');
  await swipe(page, 260); // широкий — вкладка, хотя раздел влево ещё есть
  await expect(h1).toHaveText('Деньги');
  await nav.getByRole('button', { name: 'Дела' }).click();
  await swipe(page, -260);
  await expect(h1).toHaveText('Цели');

  // Свайп по шапке экрана листает вкладки даже коротко — и «+» на «Задачах» после жеста по-прежнему «Написать задачу».
  await nav.getByRole('button', { name: 'Дела' }).click();
  await page.getByRole('radio', { name: 'Задачи' }).click();
  await swipe(page, -25); // жест короче порога: соседняя панель показалась и ушла
  await checked('Задачи');
  await expect(nav.getByRole('button', { name: 'Новая задача' })).toBeVisible();
  await swipe(page, -120, 30);
  await expect(h1).toHaveText('Цели');

  await nav.getByRole('button', { name: 'Отчёты' }).click();
  await checked('Деньги');
  await swipe(page, -120, 100);
  await checked('Дела');
  await swipe(page, -120, 100);
  await checked('Привычки');
  await swipe(page, -120, 100); // край обоих рядов — никуда
  await expect(h1).toHaveText('Отчёты');
  await checked('Привычки');
  await swipe(page, 260, 100); // широкий — вкладка «Цели»
  await expect(h1).toHaveText('Цели');
});

test('тап по сегменту листает панель по расположению разделов: правее — въезжает справа, левее — слева; после свайпа так же', async ({ page }) => {
  await onboard(page);
  const nav = page.getByRole('navigation', { name: 'Основное меню' });
  // Классы въезда остаются на панели после анимации — по ним видно, с какой стороны она пришла.
  const entered = page.locator('.pane-enter-right, .pane-enter-left');

  await nav.getByRole('button', { name: 'Отчёты' }).click();
  await expect(entered).toHaveCount(0); // первый показ — без анимации
  await page.getByRole('radio', { name: 'Привычки' }).click();
  await expect(entered).toHaveClass(/pane-enter-right/);
  await page.getByRole('radio', { name: 'Деньги' }).click();
  await expect(entered).toHaveClass(/pane-enter-left/);
  await page.getByRole('radio', { name: 'Дела' }).click();
  await expect(entered).toHaveClass(/pane-enter-right/);

  // После свайпа направление тапа по-прежнему от расположения, а не от прошлого жеста.
  await swipe(page, 120, 100); // Дела → Деньги (слева)
  await expect(page.getByRole('radio', { name: 'Деньги' })).toHaveAttribute('aria-checked', 'true');
  await expect(entered).toHaveClass(/pane-enter-left/);
  await page.getByRole('radio', { name: 'Привычки' }).click();
  await expect(entered).toHaveClass(/pane-enter-right/);

  await nav.getByRole('button', { name: 'Дела' }).click();
  await page.getByRole('radio', { name: 'Привычки' }).click();
  await expect(entered).toHaveClass(/pane-enter-right/);
  await page.getByRole('radio', { name: 'Задачи' }).click();
  await expect(entered).toHaveClass(/pane-enter-left/);
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
