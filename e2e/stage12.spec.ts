import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers';

async function swipePage(page: Page, dx: number, y = 560) {
  const x0 = dx < 0 ? 330 : 60;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 + (dx * i) / 10, y + i);
  await page.mouse.up();
}

test('свайп между вкладками: Сегодня → Деньги → Дела → Отчёты и обратно', async ({ page }) => {
  await onboard(page);
  const h1 = page.getByRole('heading', { level: 1 });
  await swipePage(page, -220);
  await expect(h1).toHaveText('Деньги');
  await swipePage(page, -220);
  await expect(h1).toHaveText('Дела');
  await swipePage(page, -220);
  await expect(h1).toHaveText('Отчёты');
  await swipePage(page, -220); // дальше некуда
  await expect(h1).toHaveText('Отчёты');
  await swipePage(page, 220);
  await expect(h1).toHaveText('Дела');
  // Короткий жест не листает
  await swipePage(page, 30);
  await expect(h1).toHaveText('Дела');
});

test('свайп по строке истории удаляет запись, а не листает вкладку', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  await d.getByRole('button', { name: '7', exact: true }).click();
  await d.getByRole('radio', { name: 'Кафе' }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  const row = page.locator('main').getByRole('button', { name: /Кафе/ });
  // Строка истории внизу экрана — дождаться, пока уйдёт toast после сохранения, иначе свайп попадёт в него.
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 10_000 });
  const box = (await row.boundingBox())!;
  await swipePage(page, -250, box.y + box.height / 2);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Деньги');
  await expect(page.getByRole('status')).toContainText('Запись удалена');
});

test('все счета видны сразу, без горизонтальной прокрутки', async ({ page }) => {
  await onboard(page, { MBank: '20 000', USDT: '200' });
  const list = page.getByRole('list', { name: 'Счета' });
  for (const name of ['MBank', 'О!Банк', 'Оптима', 'Наличные', 'USDT']) {
    await expect(list.getByRole('button', { name: new RegExp(`^${name}:`) })).toBeInViewport();
  }
  await expect(list).toContainText('Всего');
  const scrollers = await page.evaluate(() =>
    [...document.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el);
      return (s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth;
    }).length,
  );
  expect(scrollers).toBe(0);
});

test('скругления только из двух токенов: 8 у карточек, 6 у элементов управления', async ({ page }) => {
  await onboard(page);
  for (const tab of ['Сегодня', 'Деньги', 'Дела', 'Отчёты']) {
    await page.getByRole('navigation').getByRole('button', { name: tab }).click();
    const radii = await page.evaluate(() => {
      const out = new Set<string>();
      for (const el of document.querySelectorAll('main *')) {
        const r = getComputedStyle(el).borderTopLeftRadius;
        if (r === '0px') continue;
        const rect = el.getBoundingClientRect();
        // Настоящие круги (значки, чекбоксы, точки) не считаем
        if (parseFloat(r) >= Math.min(rect.width, rect.height) / 2 - 1) continue;
        out.add(r);
      }
      return [...out];
    });
    expect(radii.filter((r) => !['8px', '6px', '4px', '2px'].includes(r)), tab).toEqual([]);
  }
});

test('поля ввода не мельче 16 px — иначе iOS увеличивает страницу и меню уезжает', async ({ page }) => {
  await onboard(page);
  const smallInputs = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('input, textarea, select')]
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
        .map((el) => el.getAttribute('aria-label') ?? el.getAttribute('placeholder') ?? el.tagName),
    );
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  expect(await smallInputs()).toEqual([]);
  await page.getByRole('navigation').getByRole('button', { name: 'Дела' }).click();
  expect(await smallInputs()).toEqual([]);
  await page.getByRole('radio', { name: 'Привычки' }).click();
  await page.getByRole('button', { name: 'Добавить привычку' }).click();
  await expect(page.locator('input').first()).toBeVisible();
  expect(await smallInputs()).toEqual([]);
});
