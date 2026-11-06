import { expect, test, type Page } from '@playwright/test';
import { showAccounts } from './helpers';

const NOV_4 = new Date('2026-11-04T10:00:00+06:00');

async function addRecurring(page: Page, open: () => Promise<void>, fields: { name?: string; amount: string; day?: string }) {
  await open();
  const sheet = page.getByRole('dialog').last();
  if (fields.name) await sheet.getByLabel('Название').fill(fields.name);
  await sheet.getByLabel(/^Сумма/).fill(fields.amount);
  if (fields.day) await sheet.getByLabel('Число месяца').selectOption(fields.day);
  await sheet.getByRole('button', { name: 'Сохранить' }).click();
  await expect(sheet).toHaveCount(0);
}

async function setupControlExample(page: Page) {
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

test('контрольный пример SPEC 4.4: лимит 1 850, осталось 1 210', async ({ page }) => {
  await setupControlExample(page);
  const card = page.getByLabel('Лимит на день');
  await expect(card).toContainText(/1\s850\s*сом/);
  await expect(card).toContainText('Потрачено 640');
  await expect(card).toContainText('Осталось 1 210');
  await expect(card).toContainText('Свободно 11 100 сом на 6 дней до «Зарплата» (10 ноября)');
  await expect(card).toContainText('27 600 на счетах − 16 500 обязательных');
});

test('«Оплачено» записывает платёж, лимит не меняется', async ({ page }) => {
  await setupControlExample(page);
  await expect(page.getByText(/^Завтра · 15\s000\sсом$/)).toBeVisible();
  await page.getByRole('button', { name: 'Оплачено: Аренда квартиры' }).click();
  await expect(page.getByText('Записано')).toBeVisible();
  await expect(page.getByRole('button', { name: /^MBank: 4\s360\sсом/ })).toBeVisible();
  await expect(page.getByText('Аренда квартиры', { exact: true })).toHaveCount(0, { timeout: 4000 });
  await expect(page.getByLabel('Лимит на день')).toContainText(/1\s850\s*сом/);
  await expect(page.getByLabel('Лимит на день')).toContainText('Осталось 1 210');
});

test('«…» — поправить сумму или пропустить', async ({ page }) => {
  await setupControlExample(page);
  await page.getByRole('button', { name: 'Ещё: Интернет' }).click();
  await page.getByRole('dialog', { name: 'Интернет' }).getByRole('button', { name: 'Пропустить' }).click();
  await expect(page.getByText('Интернет', { exact: true })).toHaveCount(0);
  // M = 15 000 + 500 → (27 600 − 15 500) / 6 = 2 016 → 2 010
  await expect(page.getByLabel('Лимит на день')).toContainText(/2\s010\s*сом/);
});

test('зарплата пришла раньше 17:00: «Уже пришло» записывает доход', async ({ page }) => {
  await setupControlExample(page);
  await page.clock.setFixedTime(new Date('2026-11-10T09:00:00+06:00'));
  await page.reload();
  await expect(page.getByText('Сегодня в 17:00 зачислится само · 60 000 сом')).toBeVisible();
  await page.getByRole('button', { name: 'Уже пришло: Зарплата' }).click();
  await page.getByRole('dialog', { name: 'Зарплата' }).getByRole('button', { name: 'Пришло' }).click();
  await expect(page.getByRole('button', { name: /^MBank: 79\s360\sсом/ })).toBeVisible();
  await expect(page.getByText('Сегодня в 17:00 зачислится само')).toHaveCount(0, { timeout: 4000 });
});

test('«Регулярные» из «Денег»', async ({ page }) => {
  await setupControlExample(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await page.getByRole('button', { name: 'Регулярные' }).click();
  await expect(page.getByRole('heading', { name: 'Регулярные', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Аренда квартиры.*5-го числа · ближайший 5 ноября/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Зарплата.*10-го числа/ })).toBeVisible();
});
