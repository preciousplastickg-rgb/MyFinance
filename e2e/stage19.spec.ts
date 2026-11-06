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
