import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

/**
 * Приёмка этапа 25: тап по счёту на «Сегодня» открывает экран счёта (остаток, пришло / ушло, операции),
 * в «Деньгах» над доходами и расходами — остаток на счетах; «Цели» сворачиваются (проверяется в stage21).
 */
test('экран счёта: остаток, «Ушло», строка «Расходы» → операции, «Вся история» → «Деньги» с фильтром', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  for (const k of ['3', '00']) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('radio', { name: 'Кафе' }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(d).toHaveCount(0);

  await page.getByRole('button', { name: /^MBank: 19\s700\sсом\. Открыть счёт$/ }).click();
  await expect(page.getByRole('heading', { name: 'MBank', level: 1 })).toBeVisible();
  // Остаток — крупно в шапке над «Пришло / Ушло» (этап 27).
  await expect(page.getByLabel('Остаток на счёте')).toContainText(/в лимите на день.*Остаток19\s700 сом/);
  const flow = page.getByLabel('Движение по счёту');
  await expect(flow).toContainText(/Пришло0/);
  await expect(flow).toContainText(/Ушло−300/);
  await expect(page.getByLabel('Операции по счёту')).toContainText('Кафе');

  await flow.getByRole('button', { name: /^Расходы/ }).click();
  const sheet = page.getByRole('dialog', { name: 'MBank: Расходы' });
  await expect(sheet.getByRole('button', { name: /Кафе.*300/ })).toBeVisible();
  await sheet.getByRole('button', { name: 'Закрыть' }).click();

  await page.getByRole('button', { name: 'Вся история ›' }).click();
  await expect(page.getByRole('heading', { name: 'Деньги', level: 1 })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Фильтр по счёту' }).getByRole('button', { name: 'MBank' })).toHaveAttribute('aria-pressed', 'true');

  // В «Деньгах» тап по счёту тоже открывает экран счёта (этап 27), назад — «‹ Деньги»; валютный счёт без курса — «курса нет».
  await page.getByRole('button', { name: /^USDT: 200\sUSDT\. Открыть счёт$/ }).click();
  await expect(page.getByRole('heading', { name: 'USDT', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Остаток на счёте')).toContainText(/Остаток200 USDTкурса нет/);
  await page.getByRole('button', { name: 'Деньги' }).click();
  await expect(page.getByRole('heading', { name: 'Деньги', level: 1 })).toBeVisible();
});

test('«Деньги»: над доходами и расходами — остаток на счетах', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  // USDT без курса в остаток не входит: 20 000 сом без «≈».
  await expect(page.getByLabel('Итоги месяца')).toContainText(/Остаток на счетах20\s000\sсом/);
});
