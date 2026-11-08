import { expect, test, type Page } from '@playwright/test';
import { addTask, NOV_4, onboard, settled } from './helpers';

/**
 * Приёмка этапа 29: кредит и рассрочка с календарём платежей, дедлайн и стоимость дела, новые категории по алфавиту,
 * порядок целей, выключатель анимаций, анимированная смена темы, свайп вкладок с соседней страницей, закрытие окон вниз.
 */
async function drag(page: Page, from: { x: number; y: number }, d: { x: number; y: number }, release = true) {
  await settled(page);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(from.x + (d.x * i) / 10, from.y + (d.y * i) / 10);
  if (release) await page.mouse.up();
}

test('кредит: 100 000 на 12 месяцев под 24 % — платёж 9 455,96, календарь из 12 платежей, на «Сегодня» — за три дня до срока', async ({ page }) => {
  await page.clock.setFixedTime(NOV_4);
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await page.getByRole('button', { name: 'Регулярные' }).click();
  await page.getByRole('button', { name: 'Добавить кредит или рассрочку' }).click();
  const d = page.getByRole('dialog', { name: 'Новый кредит' });
  await d.getByLabel('Название').fill('Кредит на ремонт');
  await d.getByLabel(/^Сумма кредита/).fill('100 000');
  await d.getByLabel('Срок, месяцев').fill('12');
  await d.getByLabel('Ставка, % годовых').fill('24');
  await d.getByLabel('На что').selectOption({ label: 'Дом' });

  const sum = d.getByLabel('Итоги');
  await expect(sum).toContainText(/Платёж в месяц\s*9\s455,96\sсом/);
  await expect(sum).toContainText(/Переплата\s*13\s4\d\d(,\d\d)?\s·\s13,4\d%/);
  await expect(sum).toContainText('24% годовых');
  await expect(sum).toContainText('Выплачено 0 из 12');
  const calendar = d.getByRole('list').filter({ has: page.getByLabel('Платёж 1: дата') });
  await expect(calendar.getByRole('listitem')).toHaveCount(12);
  // Первый платёж — через 30 дней, дальше то же число каждого месяца.
  await expect(d.getByLabel('Платёж 1: дата')).toHaveValue('2026-12-04');
  await expect(d.getByLabel('Платёж 12: дата')).toHaveValue('2027-11-04');

  // Правка календаря руками: последний платёж — как в графике банка; итог «всего» пересчитывается.
  await d.getByLabel('Платёж 12: сумма').fill('10 000');
  await expect(d.getByRole('button', { name: 'Пересчитать по условиям' })).toBeVisible();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(d).toHaveCount(0);

  const group = page.getByRole('heading', { name: 'Кредиты и рассрочки' }).locator('..').locator('..');
  await expect(group).toContainText('Кредит на ремонт');
  await expect(group).toContainText(/Кредит · 0 из 12 · ближайший 4 декабря/);

  // 30 ноября платёж 4 декабря ещё не подошёл; 1 декабря — за три дня до срока — появляется на «Сегодня» с номером.
  await page.clock.setFixedTime(new Date('2026-11-30T10:00:00+06:00'));
  await page.reload();
  await expect(page.getByRole('button', { name: /^Ближайшие платежи/ })).toHaveCount(0);
  await page.clock.setFixedTime(new Date('2026-12-01T10:00:00+06:00'));
  await page.reload();
  await expect(page.getByRole('button', { name: /^Ближайшие платежи/ })).toBeVisible();
  await expect(page.getByText(/9\s455,96\sсом · 1 из 12/)).toBeVisible();
});

test('рассрочка: 30 000 на 3 месяца без наценки — 10 000 в месяц, переплаты нет', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await page.getByRole('button', { name: 'Регулярные' }).click();
  await page.getByRole('button', { name: 'Добавить платёж' }).click();
  // Из обычного платежа — ссылка на кредит / рассрочку.
  await page.getByRole('button', { name: /Это кредит или рассрочка/ }).click();
  const d = page.getByRole('dialog', { name: 'Новый кредит' });
  await d.getByRole('radio', { name: 'Рассрочка' }).click();
  const r = page.getByRole('dialog', { name: 'Новая рассрочка' });
  await r.getByLabel('Название').fill('Телефон');
  await r.getByLabel(/^Стоимость покупки/).fill('30 000');
  await r.getByLabel('Срок, месяцев').fill('3');
  await expect(r.getByLabel('Итоги')).toContainText(/Платёж в месяц\s*10\s000\sсом/);
  await expect(r.getByLabel('Итоги')).toContainText(/Переплата\s*0\s·\s0%/);
  await r.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('button', { name: /Телефон.*Рассрочка · 0 из 3/ })).toBeVisible();
});

test('дело с дедлайном и стоимостью: «дедлайн завтра» и сумма в строке', async ({ page }) => {
  await page.clock.setFixedTime(NOV_4);
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Дела' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Новая задача' }).click();
  const d = page.getByRole('dialog', { name: 'Новая задача' });
  await d.getByLabel('Название').fill('Купить билеты');
  await d.getByLabel('Дедлайн').fill('2026-11-05');
  await d.getByLabel('Стоимость').fill('4 500');
  await d.getByLabel('Валюта стоимости').selectOption('USD');
  await d.getByRole('button', { name: 'Добавить' }).click();
  await expect(d).toHaveCount(0);
  const row = page.locator('li').filter({ hasText: 'Купить билеты' });
  await expect(row).toContainText('дедлайн завтра');
  await expect(row).toContainText(/4\s500\sUSD/);
});

test('новые категории встают по алфавиту среди своих', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: /^Категории/ }).click();
  for (const name of ['Аптека', 'Такси']) {
    await page.getByRole('button', { name: 'Новая категория' }).click();
    const d = page.getByRole('dialog', { name: 'Новая категория' });
    await d.getByLabel('Название').fill(name);
    await d.getByRole('button', { name: 'Сохранить' }).click();
    await expect(d).toHaveCount(0);
  }
  const names = await page.getByRole('button', { name: /^Переместить / }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!.replace('Переместить ', '')));
  expect(names[0]).toBe('Аптека');
  expect(names.indexOf('Такси')).toBe(names.indexOf('Транспорт') - 1);
});

test('цели переставляются: ручка и стрелки меняют порядок', async ({ page }) => {
  await onboard(page);
  const nav = page.getByRole('navigation', { name: 'Основное меню' });
  await nav.getByRole('button', { name: 'Цели' }).click();
  for (const name of ['Отпуск', 'Машина']) {
    await nav.getByRole('button', { name: 'Новая цель' }).click();
    const d = page.getByRole('dialog', { name: 'Новая цель' });
    await d.getByLabel('Название цели').fill(name);
    await d.getByRole('button', { name: 'Готово' }).click();
    await expect(d).toHaveCount(0);
  }
  const order = () => page.getByRole('button', { name: /^Переместить / }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  await expect.poll(order).toEqual(['Переместить Отпуск', 'Переместить Машина']);
  await page.getByRole('button', { name: 'Переместить Отпуск' }).press('ArrowDown');
  await expect.poll(order).toEqual(['Переместить Машина', 'Переместить Отпуск']);
  await page.reload();
  await nav.getByRole('button', { name: 'Цели' }).click();
  await expect.poll(order).toEqual(['Переместить Машина', 'Переместить Отпуск']);
});

test('анимации выключаются в настройках и остаются выключенными после перезапуска; тема меняется кнопкой', async ({ page }) => {
  await onboard(page);
  const html = page.locator('html');
  await page.getByRole('button', { name: 'Тёмная тема' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByText(/^Не получилось/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Настройки' }).click();
  const sw = page.getByRole('switch', { name: 'Анимации' });
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(html).toHaveAttribute('data-motion', 'off');
  await page.reload();
  await expect(html).toHaveAttribute('data-motion', 'off');
  await page.getByRole('button', { name: 'Настройки' }).click();
  await expect(page.getByRole('switch', { name: 'Анимации' })).toHaveAttribute('aria-checked', 'false');
});

/** Сколько анимаций идёт через два кадра после действия: при анимированных окнах их было бы больше нуля. */
const running = (page: Page) =>
  page.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return document.getAnimations().filter((a) => a.playState === 'running').length;
  });

test('окна и экраны появляются сразу — анимирована только смена темы', async ({ page }) => {
  await onboard(page);
  const nav = page.getByRole('navigation', { name: 'Основное меню' });
  await nav.getByRole('button', { name: 'Новая запись' }).click();
  const entry = page.getByRole('dialog', { name: 'Новая запись' });
  await expect(entry).toBeVisible();
  expect(await running(page)).toBe(0);
  await entry.getByRole('button', { name: 'Отмена' }).click();
  await expect(entry).toHaveCount(0);

  await page.getByRole('button', { name: 'Настройки' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Настройки' })).toBeVisible();
  expect(await running(page)).toBe(0);
  await page.getByRole('button', { name: /^Оформление/ }).click();
  await expect(page.getByRole('dialog', { name: 'Оформление' })).toBeVisible();
  expect(await running(page)).toBe(0);
  await page.getByRole('dialog', { name: 'Оформление' }).getByRole('button', { name: 'Закрыть' }).click();
  await page.getByRole('button', { name: 'Сегодня' }).click();
  await expect(page.getByRole('button', { name: 'Тёмная тема' })).toBeVisible();

  // Смена темы — единственное, что анимировано: круг новой темы (или перетекание цветов) идёт и после двух кадров.
  const animated = await page.evaluate(async () => {
    (document.querySelector('[aria-label="Тёмная тема"]') as HTMLElement).click();
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      if (document.getAnimations().some((a) => a.playState === 'running')) return true;
    }
    return false;
  });
  expect(animated).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('соседняя страница смонтирована до жеста, едет рядом и после отпускания становится текущей тем же экземпляром', async ({ page }) => {
  await onboard(page);
  // Этап 31: соседи монтируются заранее, в простое, — к жесту «Деньги» уже нарисованы.
  const next = page.locator('main [data-lane="next"]');
  await expect(next).toContainText('Деньги');
  await next.evaluate((el) => el.setAttribute('data-was-neighbor', ''));
  await drag(page, { x: 330, y: 500 }, { x: -250, y: 0 }, false);
  await page.mouse.up();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Деньги');
  await expect(page.locator('main [data-lane="current"]')).toHaveAttribute('data-was-neighbor', '');
});

test('лента едет одним transform, в своём слое только на время жеста, без рывка в начале', async ({ page }) => {
  await onboard(page);
  const lane = page.locator('main > div');
  const style = () => lane.evaluate((el: HTMLElement) => ({ transform: el.style.transform, willChange: el.style.willChange }));
  expect(await style()).toEqual({ transform: '', willChange: '' });
  await drag(page, { x: 330, y: 500 }, { x: -150, y: 0 }, false);
  // Первые 10 px ушли на распознавание жеста: страница отстаёт от пальца на них, а не прыгает.
  await expect.poll(style).toEqual({ transform: 'translate3d(-140px, 0px, 0px)', willChange: 'transform' });
  // Палец постоял: решает проекция — дальше половины ширины. Доводим до 65 % и отпускаем.
  for (let i = 1; i <= 5; i++) await page.mouse.move(330 - 150 - 22 * i, 500);
  await page.mouse.up();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Деньги');
  await expect.poll(style).toEqual({ transform: '', willChange: '' });
});

test('«Новая запись» закрывается свайпом вниз с клавиатуры — не только за шапку', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  await settled(page);
  const key = (await d.getByRole('button', { name: '5', exact: true }).boundingBox())!;
  await drag(page, { x: key.x + key.width / 2, y: key.y + key.height / 2 }, { x: 0, y: 220 });
  await expect(d).toHaveCount(0);
});
