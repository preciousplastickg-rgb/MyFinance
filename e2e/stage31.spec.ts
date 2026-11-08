import { chromium, expect, test, type Page } from '@playwright/test';
import { addTask, onboard, screen, settled } from './helpers';

/**
 * Приёмка этапа 31 (SPEC 9b): свайпы одной лентой. Любой свайп — ровно одна страница: Сегодня → Деньги → Дела · Задачи →
 * Дела · Привычки → Цели → Отчёты · Деньги → Отчёты · Дела → Отчёты · Привычки; на краях — резинка. Решение — по проекции
 * и рывку; пилюля меню и панель разделов едут за пальцем; строки и окна свайпаются по-своему.
 */

const W = 390; // iPhone 13

/**
 * Палец по экрану: шаги по stepMs, пауза перед отпусканием; release = false — палец остаётся на экране. Переключение без рывка —
 * дальше половины ширины (−230): короче решает скорость, а она у Playwright под нагрузкой непредсказуема.
 */
async function drag(page: Page, dx: number, { steps = 10, stepMs = 0, hold = 0, release = true, y = 430 } = {}) {
  await settled(page);
  const x0 = dx < 0 ? 340 : 50;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + (dx * i) / steps, y);
    if (stepMs) await page.waitForTimeout(stepMs);
  }
  if (hold) await page.waitForTimeout(hold);
  if (release) await page.mouse.up();
}

/** Где сейчас лента: сдвиг контейнера по x (0 — на месте). */
const laneX = (page: Page) =>
  page.locator('main > div').evaluate((el: HTMLElement) => {
    const m = /translate3d\((-?[\d.]+)px/.exec(el.style.transform);
    return m ? Number(m[1]) : 0;
  });

/** Палец постоял на полпути (проверки) — скорости нет, решает проекция: доводим до 70 % ширины и отпускаем. */
async function finishPastHalf(page: Page) {
  for (let i = 1; i <= 4; i++) await page.mouse.move(340 - (W / 2 + 10) - 20 * i, 430);
  await page.mouse.up();
}

const centerX = async (page: Page, selector: string) => {
  const b = (await page.locator(selector).first().boundingBox())!;
  return b.x + b.width / 2;
};

test('порядок ленты: Деньги → Задачи → Привычки → Цели → Отчёты · Деньги; на краях — резинка', async ({ page }) => {
  await onboard(page);
  const nav = page.getByRole('navigation', { name: 'Основное меню' });
  const h1 = page.getByRole('heading', { level: 1 });
  const checked = (name: string) => expect(page.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');

  await nav.getByRole('button', { name: 'Деньги' }).click();
  await drag(page, -230);
  await expect(h1).toHaveText('Дела');
  await checked('Задачи');
  await drag(page, -230);
  await expect(h1).toHaveText('Дела');
  await checked('Привычки');
  await drag(page, -230);
  await expect(h1).toHaveText('Цели');
  await drag(page, -230);
  await expect(h1).toHaveText('Отчёты');
  await checked('Деньги');

  // Отчёты · Привычки — конец ленты: страница едет заметно меньше пальца и возвращается.
  await page.getByRole('radio', { name: 'Привычки' }).click();
  await drag(page, -240, { steps: 12, stepMs: 16, release: false });
  await expect.poll(() => laneX(page)).toBeLessThan(-60);
  const x = await laneX(page);
  expect(x).toBeGreaterThan(-115); // (1 − 1 / (230 × 0,55 / 390 + 1)) × 390 ≈ 95
  await page.mouse.up();
  await settled(page);
  await checked('Привычки');
  expect(await laneX(page)).toBe(0);

  // Начало ленты: «Сегодня» вправо — резинка.
  await nav.getByRole('button', { name: 'Сегодня' }).click();
  await drag(page, 200, { steps: 12, stepMs: 16, release: false });
  await expect.poll(() => laneX(page)).toBeGreaterThan(40);
  expect(await laneX(page)).toBeLessThan(100);
  await page.mouse.up();
  await settled(page);
  await expect(page.getByRole('button', { name: /\. Выбрать день$/ })).toBeVisible();
});

test('медленный свайп на 40 % возвращает, быстрый рывок на 20 % переключает', async ({ page }) => {
  await onboard(page);
  const h1 = page.getByRole('heading', { level: 1 });
  // 40 % ширины медленно, палец замер перед отпусканием: проекция не дальше половины — назад.
  await drag(page, -(0.4 * W + 10), { steps: 20, stepMs: 40, hold: 200 });
  await settled(page);
  await expect(page.getByRole('button', { name: /\. Выбрать день$/ })).toBeVisible();
  expect(await laneX(page)).toBe(0);
  // 20 % ширины рывком — следующая страница.
  await drag(page, -(0.2 * W + 10), { steps: 4 });
  await expect(h1).toHaveText('Деньги');
  // Рывок назад отменяет, даже если палец ушёл далеко: −70 %, потом резко обратно на 15 %.
  await settled(page);
  await page.mouse.move(340, 430);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) {
    await page.mouse.move(340 - 20 * i, 430);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(100);
  for (let i = 1; i <= 3; i++) await page.mouse.move(60 + 20 * i, 430);
  await page.mouse.up();
  await settled(page);
  await expect(h1).toHaveText('Деньги');
});

test('пилюля меню и панель разделов едут за пальцем пропорционально', async ({ page }) => {
  await onboard(page);
  const nav = page.getByRole('navigation', { name: 'Основное меню' });
  await nav.getByRole('button', { name: 'Деньги' }).click();
  const money = await centerX(page, 'nav [aria-label="Деньги"]');
  const tasks = await centerX(page, 'nav [aria-label="Дела"]');
  expect(Math.abs((await centerX(page, '[data-nav-pill]')) - money)).toBeLessThan(1);

  // Деньги → Дела, палец на полпути: пилюля между вкладками, панель разделов «Дел» наполовину видна.
  await drag(page, -(W / 2 + 10), { steps: 12, stepMs: 16, release: false });
  await expect.poll(() => laneX(page)).toBeLessThan(-150);
  const pill = await centerX(page, '[data-nav-pill]');
  expect(pill).toBeGreaterThan(money + 10);
  expect(pill).toBeLessThan(tasks - 10);
  const opacity = Number(await page.locator('[data-subnav-layer="Раздел"]').evaluate((el: HTMLElement) => el.style.opacity));
  expect(opacity).toBeGreaterThan(0.3);
  expect(opacity).toBeLessThan(0.7);
  await finishPastHalf(page);
  await expect(page.getByRole('radio', { name: 'Задачи' })).toHaveAttribute('aria-checked', 'true');
  await settled(page);
  expect(Math.abs((await centerX(page, '[data-nav-pill]')) - tasks)).toBeLessThan(1);

  // Между разделами одной вкладки пилюля стоит, а подсветка в панели едет.
  const mark = '[data-subnav-panel="Раздел"] [role="radiogroup"] > span';
  const first = await centerX(page, mark);
  await drag(page, -(W / 2 + 10), { steps: 12, stepMs: 16, release: false });
  await expect.poll(() => laneX(page)).toBeLessThan(-150);
  expect(Math.abs((await centerX(page, '[data-nav-pill]')) - tasks)).toBeLessThan(1);
  expect(await centerX(page, mark)).toBeGreaterThan(first + 40);
  await finishPastHalf(page);
  await expect(page.getByRole('radio', { name: 'Привычки' })).toHaveAttribute('aria-checked', 'true');
});

test('строка истории удаляет по-старому, вправо — предыдущая страница; строка дела — своё «Выполнено»', async ({ page }) => {
  await onboard(page);
  const nav = page.getByRole('navigation', { name: 'Основное меню' });
  await nav.getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  for (const k of ['4', '00']) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('radio', { name: 'Кафе' }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await nav.getByRole('button', { name: 'Деньги' }).click();
  const row = screen(page).getByRole('button', { name: /^Кафе/ }).first();
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 10_000 });
  const swipeRow = async (dx: number) => {
    await row.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await settled(page);
    const b = (await row.boundingBox())!;
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(x + (dx * i) / 10, y);
    await page.mouse.up();
  };
  await swipeRow(-100);
  await expect(page.getByRole('button', { name: 'Удалить' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Деньги');
  await page.getByRole('button', { name: 'Удалить' }).click();
  await expect(screen(page).getByRole('button', { name: /^Кафе/ })).toHaveCount(0);

  // Дело: вправо — «Выполнено», лента на месте.
  await nav.getByRole('button', { name: 'Дела' }).click();
  await page.getByRole('radio', { name: 'Задачи' }).click();
  await addTask(page, 'Позвонить маме');
  const task = screen(page).locator('li').filter({ hasText: 'Позвонить маме' });
  const b = (await task.boundingBox())!;
  await page.mouse.move(b.x + 60, b.y + 28);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(b.x + 60 + 20 * i, b.y + 28);
  await expect(task.getByText('Выполнено')).toBeVisible();
  await page.mouse.up();
  await settled(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Дела');
  await expect(page.getByRole('radio', { name: 'Задачи' })).toHaveAttribute('aria-checked', 'true');
  expect(await laneX(page)).toBe(0);
});

test('свайп в окне ленту под ним не листает', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  await settled(page);
  // Влево в «Новой записи» — тип «Доход», а не следующая страница ленты.
  await drag(page, -200, { y: 300 });
  await expect(d.getByRole('radio', { name: 'Доход' })).toHaveAttribute('aria-checked', 'true');
  expect(await laneX(page)).toBe(0);
  await d.getByRole('button', { name: 'Отмена' }).click();
  await expect(page.getByRole('button', { name: /\. Выбрать день$/ })).toBeVisible();
});

test('с выключенными «Анимациями» после отпускания страница встаёт на место сразу', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('switch', { name: 'Анимации' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await page.getByRole('button', { name: 'Сегодня' }).click(); // «‹ Сегодня» в шапке настроек: меню под экраном скрыто
  await expect(page.getByRole('button', { name: /\. Выбрать день$/ })).toBeVisible();
  await drag(page, -230);
  // Сразу после отпускания: новая страница, лента на месте и без перехода — доезда нет. (Проверка «getAnimations пуст» здесь
  // бессмысленна: data-motion="off" укорачивает любую анимацию до 0,01 мс, а мгновенные переходы от фонового монтирования
  // соседей могут попасть в снимок.)
  const state = await page.evaluate(() => {
    const lane = document.querySelector('main > div') as HTMLElement;
    return { h1: document.querySelector('main [data-lane="current"] h1')?.textContent, lane: lane.style.transform, transition: lane.style.transition };
  });
  expect(state).toEqual({ h1: 'Деньги', lane: '', transition: '' });
});

// @perf — отдельный проект в playwright.config.ts: идёт после остальных тестов, один, чтобы соседние воркеры не отнимали процессор.
test('замер: CPU 4× — не больше 3 кадров длиннее 20 мс за жест (Chromium) @perf', async ({}, testInfo) => {
  test.setTimeout(120_000);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: W, height: 664 }, deviceScaleFactor: Number(process.env.PERF_DPR ?? 3), isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  try {
    await onboard(page);
    const cdp = await ctx.newCDPSession(page);
    await page.waitForTimeout(1000); // соседние страницы монтируются в простое

    /** Касание через CDP (pointerType touch), кадры — по requestAnimationFrame от касания до конца доезда. */
    const gesture = async (dx: number) => {
      await page.evaluate(() => {
        const w = window as unknown as { __frames: number[]; __gen: number };
        w.__frames = [];
        const gen = (w.__gen = (w.__gen ?? 0) + 1);
        const loop = (t: number) => {
          if (w.__gen !== gen) return;
          w.__frames.push(t);
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      });
      const x0 = dx < 0 ? 330 : 60;
      const y = 400;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
      for (let i = 1; i <= 16; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / 16, y: y + i * 0.5 }] });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(600);
      const long = await page.evaluate(() => {
        const w = window as unknown as { __frames: number[]; __gen: number };
        w.__gen++;
        const f = w.__frames;
        return f.slice(1).filter((t, i) => t - f[i]! > 20).length;
      });
      await page.waitForTimeout(900); // соседи новой страницы — в простое, до следующего жеста
      return long;
    };

    // Прогрев без замедления и без счёта: первый жест на холодной странице меряет браузер, а не приложение.
    await gesture(-240);
    await gesture(240);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    const results: Record<string, number> = {};
    results['Сегодня → Деньги'] = await gesture(-240);
    results['Деньги → Дела'] = await gesture(-240);
    results['Задачи → Привычки'] = await gesture(-240);
    results['Привычки → Задачи'] = await gesture(240);
    results['Задачи: начал и вернул'] = await gesture(-60);
    results['Задачи → Деньги'] = await gesture(240);
    results['Деньги → Сегодня'] = await gesture(240);
    results['Сегодня: резинка'] = await gesture(200);
    testInfo.annotations.push({ type: 'кадры > 20 мс', description: JSON.stringify(results) });
    await expect(page.getByRole('button', { name: /\. Выбрать день$/ })).toBeVisible(); // жесты дошли: снова «Сегодня»
    for (const [name, long] of Object.entries(results)) expect(long, name).toBeLessThanOrEqual(3);
  } finally {
    await browser.close();
  }
});
