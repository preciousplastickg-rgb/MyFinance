import { expect, test, type Page } from '@playwright/test';
import { onboard, setupControlExample } from './helpers';

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

test('«Сохранить» без категории не серая: подсказывает «Выберите категорию»', async ({ page }) => {
  // По замечанию пользователя (2026-11-09): «Сохранить» была серой, «нажимаю — ничего не происходит».
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  await expect(d.getByRole('button', { name: 'Сохранить' })).toBeDisabled(); // суммы нет
  for (const k of ['2', '5', '0']) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(d).toContainText('Выберите категорию');
  await d.getByRole('radio', { name: 'Кафе' }).click();
  await expect(d).not.toContainText('Выберите категорию');
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(d).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Кафе −250 сом');
});

test('«Новая запись» с категорией «Долг» → «Только запомнить»: долг-заметка, счёт и «Деньги» без изменений', async ({ page }) => {
  await onboard(page);
  // Сумма → «Ещё… → Новая» «Долг»: окно долга открывается сразу, без «Сохранить».
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  for (const k of ['5', '0', '00']) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('button', { name: 'Ещё…' }).click();
  await page.getByRole('dialog', { name: 'Все категории' }).getByRole('button', { name: 'Новая' }).click();
  const editor = page.getByRole('dialog', { name: 'Новая категория' });
  await editor.getByLabel('Название').fill('Долг');
  await editor.getByRole('button', { name: 'Сохранить' }).click();
  const link = page.getByRole('dialog', { name: /^Долг: 5\s000\sсом$/ });
  await expect(link.getByRole('radio', { name: 'Через счёт' })).toHaveAttribute('aria-checked', 'true');
  await link.getByRole('radio', { name: 'Только запомнить' }).click();
  await expect(link).toContainText('Счета не изменятся, в «Деньгах» записи не будет');
  await link.getByLabel('Кому дали').fill('Азамат');
  await link.getByRole('button', { name: 'Сохранить в долги' }).click();
  await expect(d).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText(/Дал в долг: Азамат 5\s000\sсом · без счёта/);
  await expect(page.getByRole('button', { name: /^MBank: 20\s000\sсом/ })).toBeVisible();

  // Вернули 2 000: у дохода своя категория «Долг» — заводим её так же, через «Ещё… → Новая».
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  await d.getByRole('radio', { name: 'Доход' }).click();
  for (const k of ['2', '0', '00']) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('button', { name: 'Ещё…' }).click();
  await page.getByRole('dialog', { name: 'Все категории' }).getByRole('button', { name: 'Новая' }).click();
  await editor.getByLabel('Название').fill('Долг');
  await editor.getByRole('button', { name: 'Сохранить' }).click();
  const link2 = page.getByRole('dialog', { name: /^Долг: 2\s000\sсом$/ });
  await link2.getByRole('radio', { name: 'Мне вернули' }).click();
  await expect(link2.getByRole('radio', { name: /^Азамат/ })).toHaveAttribute('aria-checked', 'true');
  await link2.getByRole('radio', { name: 'Только запомнить' }).click();
  await link2.getByRole('button', { name: 'Сохранить в долги' }).click();
  await expect(page.getByRole('status').last()).toContainText(/Вернули долг: Азамат 2\s000\sсом · без счёта/);

  // В «Деньгах» записей нет, расходов и доходов нет; в «Долгах» Азамат должен 3 000, это заметка.
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await expect(page.getByLabel('Итоги месяца')).toContainText(/Расходы0\sсом/);
  await expect(page.getByLabel('Итоги месяца')).toContainText(/Доходы0\sсом/);
  await expect(page.locator('main').getByRole('button', { name: /Азамат/ })).toHaveCount(0);
  await page.getByRole('button', { name: /^Долги/ }).click();
  await expect(page.getByRole('button', { name: /^Азамат.*заметка.*3\s000\sсом/ })).toBeVisible();
});
