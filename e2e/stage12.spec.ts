import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers';

async function swipePage(page: Page, dx: number, y = 560) {
  const x0 = dx < 0 ? 330 : 60;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 + (dx * i) / 10, y + i);
  await page.mouse.up();
}

test('свайп между вкладками: Сегодня → Деньги → Дела → Цели → Отчёты и обратно', async ({ page }) => {
  await onboard(page);
  const h1 = page.getByRole('heading', { level: 1 });
  await swipePage(page, -220);
  await expect(h1).toHaveText('Деньги');
  await swipePage(page, -220);
  await expect(h1).toHaveText('Дела');
  // Внутри «Дел» сначала листаются разделы (этап 28): Задачи → Привычки, и только потом вкладка «Цели».
  await swipePage(page, -220);
  await expect(h1).toHaveText('Дела');
  await expect(page.getByRole('radio', { name: 'Привычки' })).toHaveAttribute('aria-checked', 'true');
  await swipePage(page, -220);
  await expect(h1).toHaveText('Цели');
  await swipePage(page, -220);
  await expect(h1).toHaveText('Отчёты');
  // В «Отчётах» свайп листает разделы: Деньги → Дела; обратно — Деньги, а с края — вкладка «Цели».
  await swipePage(page, -220);
  await expect(h1).toHaveText('Отчёты');
  await expect(page.getByRole('radio', { name: 'Дела' })).toHaveAttribute('aria-checked', 'true');
  await swipePage(page, 220);
  await expect(page.getByRole('radio', { name: 'Деньги' })).toHaveAttribute('aria-checked', 'true');
  await swipePage(page, 220);
  await expect(h1).toHaveText('Цели');
  // Короткий жест не листает
  await swipePage(page, 30);
  await expect(h1).toHaveText('Цели');
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
  // Над историей теперь ещё и счета: строка может оказаться под плавающим меню — прокручиваем её в центр.
  await row.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const box = (await row.boundingBox())!;
  await swipePage(page, -250, box.y + box.height / 2);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Деньги');
  await expect(page.getByRole('status')).toContainText('Запись удалена');
});

test('все счета видны сразу, без горизонтальной прокрутки', async ({ page }) => {
  await onboard(page, { MBank: '20 000', USDT: '200' });
  const list = page.getByRole('list', { name: 'Счета' });
  for (const name of ['MBank', 'О!Банк', 'Оптима', 'Наличные', 'USDT']) {
    await expect(list.getByRole('button', { name: new RegExp(`^${name}:`) })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Свернуть счета' })).toContainText('Всего');
  const scrollers = await page.evaluate(() =>
    [...document.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el);
      return (s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth;
    }).length,
  );
  expect(scrollers).toBe(0);
});

test('скругления из токенов дизайна 2e: карточки 24, контролы 16, старых 8/6 нет', async ({ page }) => {
  await onboard(page);
  for (const tab of ['Сегодня', 'Деньги', 'Дела', 'Цели', 'Отчёты']) {
    await page.getByRole('navigation').getByRole('button', { name: tab }).click();
    const r = await page.evaluate(() => {
      const radii = new Set<string>();
      for (const el of document.querySelectorAll('main *')) {
        const v = getComputedStyle(el).borderTopLeftRadius;
        if (v === '0px') continue;
        const rect = el.getBoundingClientRect();
        // Настоящие круги и пилюли (значки, чекбоксы, точки, чипы) не считаем
        if (parseFloat(v) >= Math.min(rect.width, rect.height) / 2 - 1) continue;
        radii.add(v);
      }
      const cards = [...document.querySelectorAll('main .card')].map((el) => getComputedStyle(el).borderTopLeftRadius);
      return { radii: [...radii], cards: [...new Set(cards)] };
    });
    expect(r.radii.filter((v) => ['8px', '6px'].includes(v)), tab).toEqual([]);
    expect(r.cards.filter((v) => !['24px', '20px'].includes(v)), tab).toEqual([]);
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
