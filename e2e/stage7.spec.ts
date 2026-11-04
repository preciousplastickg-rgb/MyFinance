import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers';

// В WebKit под Playwright меню «Поделиться» не открывается — проверяем запасной путь: скачивание ссылкой.
const noWebShare = () => {
  Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(noWebShare);
});

async function addExpense(page: Page, keys: string[], category: string) {
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  for (const k of keys) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('radio', { name: category }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();
}

test('экспорт → удалить приложение → поставить заново → импорт: все данные на месте', async ({ page, browser }) => {
  await onboard(page, { MBank: '20 000', USDT: '200' });
  await addExpense(page, ['2', '5', '0'], 'Кафе');
  await addExpense(page, ['1', '2', '00'], 'Продукты');
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('radio', { name: 'Тёмная' }).click();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Сохранить бэкап/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^finance-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await file.path();
  await expect(page.getByRole('button', { name: /Сохранить бэкап\s*не было/ })).toHaveCount(0);

  // «Новая установка» — чистый контекст без данных.
  const fresh = await browser.newContext({ ...test.info().project.use });
  const p2 = await fresh.newPage();
  await p2.addInitScript(noWebShare);
  await p2.goto('/');
  await expect(p2.getByRole('heading', { name: 'Счета', level: 1 })).toBeVisible();
  await p2.getByLabel('Файл бэкапа').setInputFiles(path);
  const sheet = p2.getByRole('dialog', { name: 'Импорт бэкапа' });
  await expect(sheet).toContainText(/Счетов 5, операций 2, задач 0, бэкап от \d+ \S+/);
  await sheet.getByRole('button', { name: 'Заменить всё' }).click();

  await expect(p2.getByRole('heading', { name: 'Сегодня', level: 1 })).toBeVisible();
  await expect(p2.getByRole('button', { name: /^MBank: 18\s550\sсом/ })).toBeVisible();
  await expect(p2.getByRole('button', { name: /^USDT: 200\sUSDT/ })).toBeVisible();
  await expect(p2.locator('html')).toHaveAttribute('data-theme', 'dark');
  await p2.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await expect(p2.locator('main').getByRole('button', { name: /Кафе/ })).toBeVisible();
  await expect(p2.locator('main').getByRole('button', { name: /Продукты/ })).toBeVisible();
  await fresh.close();
});

test('CSV для Excel', async ({ page }) => {
  await onboard(page);
  await addExpense(page, ['2', '5', '0'], 'Кафе');
  await page.getByRole('button', { name: 'Настройки' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Экспорт операций в CSV/ }).click();
  const csv = await readFile(await (await download).path(), 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain('дата;тип;сумма;валюта;счёт;категория;счёт_получатель;сумма_зачисления;курс;комментарий');
  expect(csv).toMatch(/\d{4}-\d{2}-\d{2};расход;250,00;KGS;MBank;Кафе;;;;/);
});

test('удалить все данные: слово «УДАЛИТЬ» и бэкап перед удалением', async ({ page }) => {
  await onboard(page);
  await addExpense(page, ['5'], 'Кафе');
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: 'Удалить все данные' }).click();
  const sheet = page.getByRole('dialog', { name: 'Удалить все данные' });
  await expect(sheet.getByRole('button', { name: 'Удалить всё' })).toBeDisabled();
  await sheet.getByLabel(/введите УДАЛИТЬ/).fill('УДАЛИТЬ');
  const download = page.waitForEvent('download');
  await sheet.getByRole('button', { name: 'Удалить всё' }).click();
  await download;
  await expect(page.getByRole('heading', { name: 'Счета', level: 1 })).toBeVisible();
});

test('битый файл — понятная ошибка', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Файл бэкапа').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.getByRole('status')).toContainText('Это не бэкап этого приложения');
});
