import { expect, test } from '@playwright/test';
import { setupControlExample } from './helpers';

/**
 * Приёмка этапа 24 (SPEC 4.10): карточка «Остаток» на «Сегодня» вместо «Можно тратить сегодня».
 * На контрольном примере: 27 600 − 640 = 26 960 на счетах (USDT без курса в итог не входит), платежи до зарплаты 16 500,
 * дальше до 4 декабря ничего. Этап 29: строк «Свободно» и «Можно тратить сегодня» нет — внизу суммы по валютам.
 * 2026-11-08, по просьбе пользователя: в самом низу — «Можно потратить» = 26 960 без копилок − 16 500 платежей = 10 460.
 */
test('карточка «Остаток»: итог, обязательства, суммы по валютам', async ({ page }) => {
  await setupControlExample(page);
  const card = page.getByLabel('Остаток');
  await expect(card).toContainText('Остаток на счетах');
  await expect(card).toContainText(/26\s960\s*сом/);
  await expect(card).toContainText('USDT: курса нет');
  await expect(card).toContainText(/Платежи до зарплаты.*−16\s500/);
  await expect(card).not.toContainText('Платежи дальше');
  await expect(card).not.toContainText('Свободно');
  await expect(card).not.toContainText('Можно тратить сегодня');
  await expect(card.getByLabel('Можно потратить')).toHaveText(/^Можно потратить\s*без копилок и обязательств\s*10\s460\s*сом$/);
  // Валюты, которые есть: сом и USDT; доллара и евро на счетах нет — их нет и в карточке.
  const fx = card.getByRole('list', { name: 'По валютам' });
  await expect(fx.getByRole('listitem')).toHaveCount(2);
  await expect(fx).toContainText(/26\s960\sсом/);
  await expect(fx).toContainText(/300\sUSDT/);

  // Строка платежей ведёт в «Регулярные».
  await card.getByRole('button', { name: /Платежи до зарплаты/ }).click();
  await expect(page.getByRole('heading', { name: 'Регулярные', level: 1 })).toBeVisible();
});

test('долг «мне должны» виден в карточке, но в свободные не входит', async ({ page }) => {
  await setupControlExample(page);
  // Расход 3 000 с новой категорией «Долг» → «Дал в долг» (этап 19): мне должны 3 000, с MBank ушло 3 000.
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  for (const k of ['3', '0', '00']) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('button', { name: 'Ещё…' }).click();
  await page.getByRole('dialog', { name: 'Все категории' }).getByRole('button', { name: 'Новая' }).click();
  const editor = page.getByRole('dialog', { name: 'Новая категория' });
  await editor.getByLabel('Название').fill('Долг');
  await editor.getByRole('button', { name: 'Сохранить' }).click();
  await expect(editor).toHaveCount(0);
  await d.getByRole('button', { name: 'Сохранить' }).click();
  const link = page.getByRole('dialog', { name: /^Долг: 3\s000\sсом$/ });
  await link.getByLabel('Кому дали').fill('Азамат');
  await link.getByRole('button', { name: 'Сохранить в долги' }).click();
  await expect(link).toHaveCount(0);

  const card = page.getByLabel('Остаток');
  await expect(card).toContainText(/23\s960\s*сом/);
  await expect(card).toContainText(/Мне должны.*\+3\s000/);
  // «Мне должны» — не деньги на руках: можно потратить 23 960 − 16 500 = 7 460.
  await expect(card.getByLabel('Можно потратить')).toContainText(/7\s460\s*сом/);
  await card.getByRole('button', { name: /Мне должны/ }).click();
  await expect(page.getByRole('heading', { name: 'Долги', level: 1 })).toBeVisible();
});
