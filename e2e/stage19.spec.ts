import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers';

/** Новая запись: тип, сумма с клавиатуры, новая категория через «Ещё… → Новая». */
async function entryWithNewCategory(page: Page, type: 'Расход' | 'Доход', keys: string[], category: string) {
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  await d.getByRole('radio', { name: type }).click();
  for (const k of keys) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('button', { name: 'Ещё…' }).click();
  await page.getByRole('dialog', { name: 'Категория' }).getByRole('button', { name: 'Новая' }).click();
  const editor = page.getByRole('dialog', { name: 'Новая категория' });
  await editor.getByLabel('Название').fill(category);
  await editor.getByRole('button', { name: 'Сохранить' }).click();
  await expect(editor).toHaveCount(0);
  await expect(d.getByRole('radio', { name: category })).toHaveAttribute('aria-checked', 'true');
  return d;
}

test('новая категория дохода прямо из записи сразу выбрана (этап 19)', async ({ page }) => {
  await onboard(page);
  const d = await entryWithNewCategory(page, 'Доход', ['1', '0', '00'], 'Кэшбэк');
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('status')).toContainText('Кэшбэк +');
});

test('категория «Долг»: расход — «Дал в долг», доход — «Мне вернули»; всё в «Долгах», не в расходах (этап 19)', async ({ page }) => {
  await onboard(page);
  const d = await entryWithNewCategory(page, 'Расход', ['5', '0', '00'], 'Долг');
  await d.getByRole('button', { name: 'Сохранить' }).click();
  const link = page.getByRole('dialog', { name: /^Долг: 5\s000\sсом$/ });
  await expect(link.getByRole('radio', { name: 'Дал в долг' })).toHaveAttribute('aria-checked', 'true');
  await link.getByLabel('Кому дали').fill('Азамат');
  await link.getByRole('button', { name: 'Сохранить в долги' }).click();
  await expect(page.getByRole('status')).toContainText(/Дал в долг: Азамат −5\s000 сом/);

  const back = await entryWithNewCategory(page, 'Доход', ['2', '0', '00'], 'Долг');
  await back.getByRole('button', { name: 'Сохранить' }).click();
  const link2 = page.getByRole('dialog', { name: /^Долг: 2\s000\sсом$/ });
  await link2.getByRole('radio', { name: 'Мне вернули' }).click();
  await expect(link2.getByRole('radio', { name: /Азамат/ })).toHaveAttribute('aria-checked', 'true');
  await link2.getByRole('button', { name: 'Сохранить в долги' }).click();

  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await expect(page.getByLabel('Итоги месяца')).toContainText(/Расходы0\sсом/);
  await expect(page.getByLabel('Итоги месяца')).toContainText(/Доходы0\sсом/);
  await page.getByRole('button', { name: /^Долги/ }).click();
  await expect(page.getByRole('button', { name: /^Азамат.*3\s000\sсом/ })).toBeVisible();
});

test('«Вернул долг» без записанного долга: новый человек, «Всего долг» — долг заводится вместе с возвратом', async ({ page }) => {
  await onboard(page);
  const d = await entryWithNewCategory(page, 'Расход', ['3', '0', '00'], 'Долг');
  await d.getByRole('button', { name: 'Сохранить' }).click();
  const link = page.getByRole('dialog', { name: /^Долг: 3\s000\sсом$/ });
  await link.getByRole('radio', { name: 'Вернул долг' }).click();
  // Открытых долгов нет — сразу «Новый человек», кнопка доступна после имени.
  await expect(link.getByRole('radio', { name: /Новый человек/ })).toHaveAttribute('aria-checked', 'true');
  await expect(link.getByRole('button', { name: 'Сохранить в долги' })).toBeDisabled();
  await link.getByLabel('Кому вернули').fill('Бакыт');
  await link.getByLabel('Всего долг').fill('5 000');
  await link.getByRole('button', { name: 'Сохранить в долги' }).click();
  await expect(page.getByRole('status')).toContainText(/Вернул долг: Бакыт −3\s000 сом/);

  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await expect(page.getByLabel('Итоги месяца')).toContainText(/Расходы0\sсом/);
  await page.getByRole('button', { name: /^Долги/ }).click();
  await expect(page.getByRole('button', { name: /^Бакыт.*2\s000\sсом/ })).toBeVisible();

  // Открытый долг есть, но вернули другому: «Новый человек» выбирается, пустое «Всего долг» = сумма, долг сразу закрыт.
  await page.getByRole('button', { name: /Назад|Деньги/ }).first().click();
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d2 = page.getByRole('dialog', { name: 'Новая запись' });
  for (const k of ['1', '0', '00']) await d2.getByRole('button', { name: k, exact: true }).click();
  await d2.getByRole('button', { name: 'Ещё…' }).click();
  await page.getByRole('dialog', { name: 'Категория' }).getByRole('radio', { name: 'Долг' }).click();
  await d2.getByRole('button', { name: 'Сохранить' }).click();
  const link2 = page.getByRole('dialog', { name: /^Долг: 1\s000\sсом$/ });
  await link2.getByRole('radio', { name: 'Вернул долг' }).click();
  await expect(link2.getByRole('radio', { name: /^Бакыт/ })).toHaveAttribute('aria-checked', 'true');
  await link2.getByRole('radio', { name: /Новый человек/ }).click();
  await link2.getByLabel('Кому вернули').fill('Нурлан');
  await link2.getByRole('button', { name: 'Сохранить в долги' }).click();
  await expect(page.getByRole('status').last()).toContainText(/Вернул долг: Нурлан −1\s000 сом/);
  await page.getByRole('button', { name: /^Долги/ }).click();
  await expect(page.getByRole('button', { name: /^Бакыт.*2\s000\sсом/ })).toBeVisible();
  // Нурлан — сразу в «Закрытых», в «Я должен» его нет.
  await expect(page.getByRole('heading', { name: 'Закрытые' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Я должен' }).locator('xpath=ancestor::section[1]')).not.toContainText('Нурлан');
  await expect(page.getByRole('heading', { name: 'Закрытые' }).locator('xpath=ancestor::section[1]')).toContainText('Нурлан');
});
