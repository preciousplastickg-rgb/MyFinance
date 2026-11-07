import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

const NOV_4 = new Date('2026-11-04T10:00:00+06:00');

test('счета на «Сегодня» свёрнуты до «Всего», раскрываются тапом по «Счета» и это запоминается', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Остаток MBank').fill('20 000');
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Пропустить' }).click();
  await page.getByRole('button', { name: 'Пропустить' }).click();
  const list = page.getByRole('list', { name: 'Счета' });
  await expect(page.getByRole('button', { name: /счета$/ })).toContainText(/Всего.*20\s000\sсом/);
  await expect(list.getByRole('button', { name: /^MBank:/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Показать счета$/ }).click();
  await expect(list.getByRole('button', { name: /^MBank:/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('list', { name: 'Счета' }).getByRole('button', { name: /^MBank:/ })).toBeVisible();
  await page.getByRole('button', { name: /Свернуть счета$/ }).click();
  await expect(page.getByRole('list', { name: 'Счета' }).getByRole('button', { name: /^MBank:/ })).toHaveCount(0);
});

test('«Оплачено» можно отменить из toast', async ({ page }) => {
  await page.clock.setFixedTime(NOV_4);
  await page.goto('/');
  await page.getByLabel('Остаток MBank').fill('20 000');
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Пропустить' }).click();
  await page.getByRole('button', { name: 'Интернет' }).click();
  const sheet = page.getByRole('dialog').last();
  await sheet.getByLabel(/^Сумма/).fill('1 000');
  await sheet.getByLabel('Число месяца').selectOption('7');
  await sheet.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByRole('button', { name: 'Готово' }).click();

  await page.getByRole('button', { name: 'Оплачено: Интернет' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Интернет −1 000 сом' })).toBeVisible();
  await page.getByRole('button', { name: 'Отменить' }).click();
  await expect(page.getByRole('button', { name: 'Оплачено: Интернет' })).toBeVisible({ timeout: 4000 });
  await expect(page.getByRole('button', { name: /счета$/ })).toContainText(/Всего.*20\s000\sсом/);
});

test('«Дела»: дата и сфера новой задачи появляются, когда начали писать', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Дела' }).click();
  const when = page.getByRole('group', { name: 'Когда и сфера новой задачи' });
  await expect(when).toHaveCount(0);
  await page.getByLabel('Новая задача', { exact: true }).fill('Позвонить');
  await expect(when).toBeVisible();
  await when.getByRole('button', { name: 'Завтра' }).click();
  await page.getByRole('button', { name: 'Добавить задачу' }).click();
  // Дата «Завтра» осталась выбранной — кнопки не прячутся, пока она не сброшена.
  await expect(when).toBeVisible();
  await page.getByRole('tab', { name: /^Впереди/ }).click();
  await expect(page.getByText('Позвонить')).toBeVisible();
});

test('правка обмена USD → EUR показывает «Зачислено»', async ({ page }) => {
  await page.clock.setFixedTime(NOV_4);
  await page.goto('/');
  await page.getByRole('checkbox', { name: 'Добавить Доллары' }).click();
  await page.getByLabel('Остаток Доллары').fill('100');
  await page.getByRole('checkbox', { name: 'Добавить Евро' }).click();
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Пропустить' }).click();
  await page.getByRole('button', { name: 'Пропустить' }).click();

  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  await d.getByRole('radio', { name: 'Перевод' }).click();
  await d.getByRole('button', { name: /^Откуда:/ }).click();
  await page.getByRole('dialog', { name: 'Откуда' }).getByRole('button', { name: /^Доллары/ }).click();
  await d.getByRole('button', { name: /^Куда:/ }).click();
  await page.getByRole('dialog', { name: 'Куда' }).getByRole('button', { name: /^Евро/ }).click();
  await d.getByRole('button', { name: /^Сумма/ }).click();
  for (const k of ['5', '0']) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('button', { name: /Зачислено на Евро/ }).click();
  for (const k of ['4', '6']) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();

  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await page.locator('main').getByRole('button', { name: /Перевод/ }).first().click();
  const editor = page.getByRole('dialog', { name: 'Перевод' });
  await expect(editor.getByRole('button', { name: /Зачислено на Евро/ })).toContainText('46 EUR');
  await expect(editor.getByText('1 USD = 0,9200 EUR')).toBeVisible();
});
