import { expect, test, type Locator, type Page } from '@playwright/test';
import { addTask, onboard } from './helpers';

const NOV_4 = new Date('2026-11-04T10:00:00+06:00');

async function swipe(page: Page, row: Locator, dx: number) {
  await expect(row).toBeVisible();
  const box = (await row.boundingBox())!;
  const y = box.y + Math.min(box.height / 2, 28);
  const x0 = dx < 0 ? box.x + box.width - 30 : box.x + 60;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 + (dx * i) / 10, y);
  await page.mouse.up();
}

/** Центр текста названия вкладки относительно кнопки. */
async function labelOffsets(page: Page) {
  return page.getByRole('tablist', { name: 'Списки дел' }).getByRole('tab').evaluateAll((tabs) =>
    tabs.map((tab) => {
      const text = [...tab.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)!;
      const range = document.createRange();
      range.selectNodeContents(text);
      const r = range.getBoundingClientRect();
      const b = tab.getBoundingClientRect();
      return [Math.round(r.left - b.left), Math.round(r.top - b.top), Math.round(b.width)];
    }),
  );
}


test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOV_4);
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Дела' }).click();
});

test('задача, перенесённая 3 раза, попадает в «Откладывается» (приёмка этапа 8)', async ({ page }) => {
  await addTask(page, 'Позвонить в банк');
  const row = () => page.locator('li').filter({ hasText: 'Позвонить в банк' });

  await swipe(page, row(), -200);
  await row().getByRole('button', { name: 'Перенести' }).click();
  await page.getByRole('dialog', { name: 'Перенести' }).getByRole('button', { name: 'Завтра' }).click();

  await page.getByRole('tab', { name: /^Впереди/ }).click();
  await expect(page.getByText('Завтра, 5 ноября')).toBeVisible();
  await swipe(page, row(), -200);
  await row().getByRole('button', { name: 'Перенести' }).click();
  await page.getByRole('dialog', { name: 'Перенести' }).getByRole('button', { name: /^Пн, 9 ноября/ }).click();
  await expect(page.getByText('Понедельник, 9 ноября')).toBeVisible();

  await swipe(page, row(), -200);
  await row().getByRole('button', { name: 'Перенести' }).click();
  const sheet = page.getByRole('dialog', { name: 'Перенести' });
  await sheet.getByLabel('Выбрать дату').fill('2026-11-20');
  await sheet.getByRole('button', { name: 'Готово' }).click();
  await expect(row()).toContainText('Перенесено 3 раза');

  await page.getByRole('navigation').getByRole('button', { name: 'Отчёты' }).click();
  await page.getByRole('radio', { name: 'Дела' }).click();
  const stalled = page.getByRole('list', { name: 'Откладывается' });
  await expect(stalled).toContainText('Позвонить в банк');
  await expect(stalled).toContainText('Перенесено 3 раза');
  await stalled.getByRole('button', { name: 'Сделать сегодня' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Сегодня' }).click();
  await expect(page.getByRole('checkbox', { name: 'Выполнить: Позвонить в банк' })).toBeVisible();
});

test('счётчики вкладок не сдвигают названия', async ({ page }) => {
  const before = await labelOffsets(page);
  await expect(page.getByRole('tab', { name: 'Сегодня, задач: 0' })).toBeVisible();
  await expect(page.locator('[data-badge]')).toHaveCount(0);
  for (let i = 1; i <= 3; i++) await addTask(page, `Дело ${i}`);
  await page.getByRole('tab', { name: /^Без даты/ }).click();
  await addTask(page, 'Идея');
  await expect(page.getByRole('tab', { name: 'Сегодня, задач: 3' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Без даты, задач: 1' })).toBeVisible();
  await expect(page.locator('[data-badge]')).toHaveText(['3', '1']);
  expect(await labelOffsets(page)).toEqual(before);

  // Бейдж: высота 20, сдвиг −9 вверх и −3 вправо
  const badge = page.locator('[data-badge]').first();
  const tab = page.getByRole('tab', { name: /^Сегодня/ });
  const [bb, tb] = [(await badge.boundingBox())!, (await tab.boundingBox())!];
  expect(Math.round(bb.height)).toBe(20);
  expect(Math.round(tb.y - bb.y)).toBe(9);
  expect(Math.round(bb.x + bb.width - (tb.x + tb.width))).toBe(3);
  // boundingBox не знает про overflow: hidden — проверяем, что в точке бейджа под пальцем именно бейдж, а не обрезавшая его кнопка.
  // Зона нажатия вкладки — 44 px при высоте 36: на 3 px выше кнопки тап всё ещё её.
  const at = (x: number, y: number) =>
    page.evaluate(([px, py]) => {
      const el = document.elementFromPoint(px, py);
      return { badge: !!el?.closest('[data-badge]'), tab: el?.closest('[role=tab]')?.getAttribute('aria-label') ?? null };
    }, [x, y] as const);
  expect((await at(bb.x + bb.width / 2, bb.y + 2)).badge).toBe(true);
  expect((await at(tb.x + tb.width / 2, tb.y - 3)).tab).toBe('Сегодня, задач: 3');
});

test('выполнить свайпом вправо, отменить из toast; блок на «Сегодня»', async ({ page }) => {
  await addTask(page, 'Купить воду');
  await addTask(page, 'Оплатить свет');
  await swipe(page, page.locator('li').filter({ hasText: 'Купить воду' }), 200);
  // Сделанное — на вкладке «Сделано», на «Сегодня» только строка-переход.
  await page.getByRole('button', { name: 'Сделано сегодня: 1' }).click();
  await expect(page.getByRole('tab', { name: 'Сделано' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Купить воду, выполнено. Посмотреть' })).toBeVisible();
  await page.getByRole('status').getByRole('button', { name: 'Отменить' }).click();
  await expect(page.getByText('Выполненных дел пока нет')).toBeVisible();
  await page.getByRole('tab', { name: /^Сегодня/ }).click();
  await expect(page.getByRole('checkbox', { name: 'Выполнить: Купить воду' })).toBeVisible();

  await page.getByRole('navigation').getByRole('button', { name: 'Сегодня' }).click();
  await expect(page.getByRole('heading', { name: 'Дела', level: 2 })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Выполнить: Оплатить свет' }).click();
  await expect(page.getByRole('checkbox', { name: 'Выполнить: Оплатить свет' })).toHaveCount(0);
  await page.getByRole('button', { name: /Все дела/ }).click();
  await expect(page.getByRole('heading', { name: 'Дела', level: 1 })).toBeVisible();
});

test('карточка задачи: сфера, важно, повтор', async ({ page }) => {
  await addTask(page, 'Зарядка');
  await page.getByRole('button', { name: 'Зарядка' }).click();
  const card = page.getByRole('dialog', { name: 'Задача' });
  await card.getByLabel('Сфера').selectOption({ label: 'Здоровье' });
  await card.getByRole('radio', { name: 'День' }).click();
  await card.getByRole('switch', { name: 'Важно' }).click();
  await card.getByRole('button', { name: 'Сохранить' }).click();
  const row = page.locator('li').filter({ hasText: 'Зарядка' });
  await expect(row).toContainText('Здоровье');
  await expect(row).toContainText('каждый день');
  await expect(row.getByLabel('Важно')).toBeVisible();
  await row.getByRole('checkbox').click();
  await expect(page.getByRole('status')).toContainText('Сделано · следующий раз 5 ноября');
});

test('на «Сегодня» видны дела на сегодня и на завтра, тап открывает карточку', async ({ page }) => {
  await addTask(page, 'Купить воду');
  await page.getByRole('tab', { name: /^Впереди/ }).click();
  await addTask(page, 'Позвонить маме');
  await addTask(page, 'Забрать посылку');
  await page.getByRole('button', { name: 'Забрать посылку' }).click();
  await page.getByLabel('Дата', { exact: true }).fill('2026-11-10');
  await page.getByRole('button', { name: 'Сохранить' }).click();

  await page.getByRole('navigation').getByRole('button', { name: 'Сегодня' }).click();
  const main = page.locator('main');
  await expect(main.getByRole('heading', { name: /^Сегодня, 4 нояб/ })).toBeVisible();
  await expect(main.getByRole('heading', { name: /^Завтра, 5 нояб/ })).toBeVisible();
  await expect(main.getByRole('checkbox', { name: 'Выполнить: Купить воду' })).toBeVisible();
  await expect(main.getByRole('checkbox', { name: 'Выполнить: Позвонить маме' })).toBeVisible();
  await expect(main.getByRole('checkbox', { name: 'Выполнить: Забрать посылку' })).toHaveCount(0);
  await expect(main.getByText(/Дальше/)).toHaveCount(0);
  // Тап по делу на главной открывает карточку задачи
  await main.getByRole('button', { name: 'Позвонить маме' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Название')).toHaveValue('Позвонить маме');
});

test('выполненная задача: тап открывает просмотр и не возвращает в работу; вернуть — кнопкой (этап 19)', async ({ page }) => {
  await addTask(page, 'Позвонить маме');
  // Свайп вправо: зелёная плашка «Выполнено».
  const row = page.locator('li').filter({ hasText: 'Позвонить маме' });
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + 60, box.y + 28);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 60 + 20 * i, box.y + 28);
  await expect(row.getByText('Выполнено')).toBeVisible();
  await page.mouse.up();

  await page.getByRole('tab', { name: 'Сделано' }).click();
  const done = page.getByRole('button', { name: 'Позвонить маме, выполнено. Посмотреть' });
  await done.click();
  const view = page.getByRole('dialog', { name: 'Выполнено' });
  await expect(view).toContainText('Позвонить маме');
  await expect(view).toContainText(/Сегодня, 4 ноября, \d\d:\d\d/);
  await view.getByRole('button', { name: 'Закрыть' }).first().click();
  await expect(done).toBeVisible(); // по-прежнему выполнена

  await done.click();
  await page.getByRole('dialog', { name: 'Выполнено' }).getByRole('button', { name: 'Вернуть в работу' }).click();
  await expect(page.getByText('Выполненных дел пока нет')).toBeVisible();
});
