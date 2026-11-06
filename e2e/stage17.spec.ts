import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('долги: дал 5 000 с MBank, вернули 2 000; взял 10 000 без счёта (приёмка этапа 17)', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await page.getByRole('button', { name: /^Долги/ }).click();
  await expect(page.getByRole('heading', { name: 'Долги', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Дал в долг' }).click();
  const editor = page.getByRole('dialog', { name: 'Новый долг' });
  await editor.getByRole('textbox', { name: 'Кто должен' }).fill('Азамат');
  await editor.getByLabel(/^Сумма/).fill('5 000');
  await editor.getByRole('button', { name: 'Сохранить' }).click();
  await expect(editor).toHaveCount(0);
  const totals = page.getByLabel('Итоги долгов');
  await expect(totals).toContainText(/Мне должны5\s000\sсом/);

  await page.getByRole('button', { name: /^Азамат/ }).click();
  const card = page.getByRole('dialog', { name: 'Азамат' });
  await card.getByRole('button', { name: 'Вернули', exact: true }).click();
  const move = page.getByRole('dialog', { name: 'Вернули: Азамат' });
  await expect(move.getByLabel('Сумма')).toHaveValue(/^5\s000$/);
  await move.getByLabel('Сумма').fill('2 000');
  await move.getByRole('button', { name: 'Сохранить' }).click();
  await expect(card).toContainText(/3\s000\sсом/);
  await expect(card).toContainText('Вернули долг');
  await card.getByRole('button', { name: 'Закрыть' }).first().click();
  await expect(totals).toContainText(/Мне должны3\s000\sсом/);

  await page.getByRole('button', { name: 'Взял в долг' }).click();
  await editor.getByRole('textbox', { name: 'Кому должен' }).fill('Бакыт');
  await editor.getByLabel(/^Сумма/).fill('10 000');
  await editor.getByLabel('На какой счёт').selectOption({ label: 'Без счёта' });
  await editor.getByRole('button', { name: 'Сохранить' }).click();
  await expect(totals).toContainText(/Я должен10\s000\sсом/);

  // Деньги по MBank прошли (20 000 − 5 000 + 2 000), но это не доход и не расход.
  await page.getByRole('button', { name: /Назад|Деньги/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Деньги', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Итоги месяца')).toContainText(/Расходы0\sсом/);
  await expect(page.locator('main').getByRole('button', { name: /Дал в долг.*Азамат.*−5\s000/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Долги.*Мне должны 3\s000\sсом · я должен 10\s000\sсом/ })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Сегодня' }).click();
  await expect(page.getByRole('button', { name: /^MBank: 17\s000\sсом/ })).toBeVisible();
});
