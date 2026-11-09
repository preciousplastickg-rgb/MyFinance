import { expect, test, type Page } from '@playwright/test';
import { setupControlExample } from './helpers';

/**
 * По просьбе пользователя (2026-11-09): долг «Только запомнить» (SPEC 4.7) — заметка «я должен столько-то»:
 * счета не двигаются, в «Остаток», «Я должен» и «Можно потратить» не входит, виден только в «Долгах».
 * Контрольный пример: на счетах 26 960, можно потратить 10 460 (этап 24).
 */
async function openDebts(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await page.getByRole('button', { name: /^Долги/ }).click();
  await expect(page.getByRole('heading', { name: 'Долги', level: 1 })).toBeVisible();
}

async function backToToday(page: Page) {
  await page.getByRole('button', { name: /Назад|Деньги/ }).first().click();
  await page.getByRole('navigation').getByRole('button', { name: 'Сегодня' }).click();
}

test('«Только запомнить»: счета и «Можно потратить» не меняются, возврат — без счёта', async ({ page }) => {
  await setupControlExample(page);
  await openDebts(page);
  await page.getByRole('button', { name: 'Взял в долг' }).click();
  const editor = page.getByRole('dialog', { name: 'Новый долг' });
  await expect(editor.getByRole('radio', { name: 'Только запомнить' })).toHaveAttribute('aria-checked', 'true');
  await expect(editor).toContainText('В «Можно потратить» не входит');
  await expect(editor.getByLabel('На какой счёт')).toHaveCount(0);
  await editor.getByRole('textbox', { name: 'Кому должен' }).fill('Налог на машину');
  await editor.getByLabel(/^Сумма/).fill('12 000');
  await editor.getByRole('button', { name: 'Сохранить' }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByLabel('Итоги долгов')).toContainText(/Я должен12\s000\sсом/);
  await expect(page.getByRole('button', { name: /^Налог на машину.*заметка/ })).toBeVisible();

  // «Вернул» 2 000 — по умолчанию «Без счёта»: остаток 10 000, отметка в истории долга.
  await page.getByRole('button', { name: /^Налог на машину/ }).click();
  const card = page.getByRole('dialog', { name: 'Налог на машину' });
  await expect(card).toContainText('Только запомнить');
  await card.getByRole('button', { name: 'Вернул', exact: true }).click();
  const move = page.getByRole('dialog', { name: 'Вернул: Налог на машину' });
  await expect(move.getByLabel('Со счёта')).toHaveValue('');
  await expect(move).toContainText('Счета не изменятся');
  await move.getByLabel('Сумма').fill('2 000');
  await move.getByRole('button', { name: 'Сохранить' }).click();
  await expect(move).toHaveCount(0);
  await expect(card).toContainText(/Вы должны10\s000\sсом/);
  await expect(card.getByRole('button', { name: /Вернул долг.*без счёта.*−2\s000/ })).toBeVisible();
  await card.getByRole('button', { name: 'Закрыть', exact: true }).click();

  // На «Сегодня»: счета и «Можно потратить» как были, строки «Я должен» нет; в «Долгах» — 10 000.
  await backToToday(page);
  const money = page.getByLabel('Остаток');
  await expect(money).toContainText(/26\s960\s*сом/);
  await expect(money).not.toContainText('Я должен');
  await expect(money.getByLabel('Можно потратить')).toContainText(/10\s460\s*сом/);
  await expect(page.getByRole('button', { name: /^MBank: 19\s360\sсом/ })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Долги' })).toContainText(/я 10\s000\sсом/);
});

test('долг, записанный на MBank, можно сделать заметкой: операция уходит, счёт возвращается как был', async ({ page }) => {
  await setupControlExample(page);
  await openDebts(page);
  await page.getByRole('button', { name: 'Взял в долг' }).click();
  const editor = page.getByRole('dialog', { name: 'Новый долг' });
  await editor.getByRole('radio', { name: 'Через счёт' }).click();
  await expect(editor).toContainText('Сумма придёт на счёт — не как доход.');
  await editor.getByRole('textbox', { name: 'Кому должен' }).fill('Бакыт');
  await editor.getByLabel(/^Сумма/).fill('5 000');
  await expect(editor.getByLabel('На какой счёт')).toHaveValue(/.+/);
  await editor.getByRole('button', { name: 'Сохранить' }).click();
  await expect(editor).toHaveCount(0);

  await backToToday(page);
  const money = page.getByLabel('Остаток');
  await expect(money).toContainText(/31\s960\s*сом/);
  await expect(money).toContainText(/Я должен.*−5\s000/);

  await openDebts(page);
  await page.getByRole('button', { name: /^Бакыт/ }).click();
  const card = page.getByRole('dialog', { name: 'Бакыт' });
  await card.getByRole('button', { name: 'Изменить' }).click();
  const edit = page.getByRole('dialog', { name: 'Долг' });
  await edit.getByRole('radio', { name: 'Только запомнить' }).click();
  await expect(edit).toContainText(/Операция «Взял в долг» MBank 5\s000\sсом удалится/);
  await edit.getByRole('button', { name: 'Сохранить' }).click();
  await expect(edit).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Бакыт: только запомнить');
  await expect(card).toContainText('Только запомнить');
  await expect(card).toContainText(/Вы должны5\s000\sсом/);
  await card.getByRole('button', { name: 'Закрыть', exact: true }).click();

  await backToToday(page);
  await expect(money).toContainText(/26\s960\s*сом/);
  await expect(money).not.toContainText('Я должен');
  await expect(money.getByLabel('Можно потратить')).toContainText(/10\s460\s*сом/);
});
