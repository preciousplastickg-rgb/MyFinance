import { expect, type Page } from '@playwright/test';

/**
 * Первый запуск: остаток на MBank и USDT, пропуск доходов и платежей.
 * Счета на «Сегодня» раскрываются (по умолчанию свёрнуты) — это состояние запоминается.
 */
export async function onboard(page: Page, balances: Record<string, string> = { MBank: '20 000', USDT: '200' }) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Счета', level: 1 })).toBeVisible();
  for (const [name, value] of Object.entries(balances)) {
    await page.getByLabel(`Остаток ${name}`).fill(value);
  }
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Пропустить' }).click();
  await page.getByRole('button', { name: 'Пропустить' }).click();
  await expect(page.getByRole('button', { name: /\. Выбрать день$/ })).toBeVisible();
  await showAccounts(page);
}

/** Раскрыть счета на «Сегодня», если они свёрнуты. */
export async function showAccounts(page: Page) {
  const toggle = page.getByRole('button', { name: /(Показать|Свернуть) счета$/ });
  await toggle.waitFor();
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

export const NOV_4 = new Date('2026-11-04T10:00:00+06:00');

export async function addRecurring(page: Page, open: () => Promise<void>, fields: { name?: string; amount: string; day?: string }) {
  await open();
  const sheet = page.getByRole('dialog').last();
  if (fields.name) await sheet.getByLabel('Название').fill(fields.name);
  await sheet.getByLabel(/^Сумма/).fill(fields.amount);
  if (fields.day) await sheet.getByLabel('Число месяца').selectOption(fields.day);
  await sheet.getByRole('button', { name: 'Сохранить' }).click();
  await expect(sheet).toHaveCount(0);
}

/** Контрольный пример SPEC 4.4: 4 ноября, MBank 20 000, Наличные 7 600, USDT 300, зарплата 60 000 10-го, аренда 15 000, интернет 1 000, связь 500, траты 240 и 400 в «Кафе». */
export async function setupControlExample(page: Page) {
  await page.clock.setFixedTime(NOV_4);
  await page.goto('/');
  await page.getByLabel('Остаток MBank').fill('20 000');
  await page.getByLabel('Остаток Наличные').fill('7 600');
  await page.getByLabel('Остаток USDT').fill('300');
  await page.getByRole('button', { name: 'Дальше' }).click();

  await addRecurring(page, () => page.getByRole('button', { name: 'Добавить источник дохода' }).click(), { amount: '60 000', day: '10' });
  await page.getByRole('button', { name: 'Дальше' }).click();

  await addRecurring(page, () => page.getByRole('button', { name: 'Аренда квартиры' }).click(), { amount: '15 000' });
  await addRecurring(page, () => page.getByRole('button', { name: 'Интернет' }).click(), { amount: '1 000' });
  await addRecurring(page, () => page.getByRole('button', { name: 'Мобильная связь' }).click(), { amount: '500' });
  await page.getByRole('button', { name: 'Готово' }).click();
  await showAccounts(page);

  for (const keys of [['2', '4', '0'], ['4', '00']]) {
    await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
    const d = page.getByRole('dialog', { name: 'Новая запись' });
    for (const k of keys) await d.getByRole('button', { name: k, exact: true }).click();
    await d.getByRole('radio', { name: 'Кафе' }).click();
    await d.getByRole('button', { name: 'Сохранить' }).click();
  }
}

/** Новая задача (этап 28): «+» в меню на «Делах» открывает окно «Новая задача»; дата — по текущей вкладке. */
export async function addTask(page: Page, title: string) {
  await page.getByRole('navigation').getByRole('button', { name: 'Новая задача' }).click();
  const d = page.getByRole('dialog', { name: 'Новая задача' });
  await d.getByLabel('Название').fill(title);
  await d.getByRole('button', { name: 'Добавить' }).click();
  await expect(d).toHaveCount(0);
}
