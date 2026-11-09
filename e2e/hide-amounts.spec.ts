import { expect, test } from '@playwright/test';
import { setupControlExample } from './helpers';

/**
 * По просьбе пользователя (SPEC 9d): глаз в шапке скрывает остатки и итоги — «••••»; состояние переживает перезапуск;
 * записи истории остаются видны.
 */
test('«Скрыть суммы»: остаток, «Можно потратить», счета и итоги «Денег» — «••••», после перезапуска так же', async ({ page }) => {
  await setupControlExample(page);
  const card = page.getByLabel('Остаток');
  await expect(card).toContainText(/26\s960/);

  await page.getByRole('button', { name: 'Скрыть суммы' }).click();
  await expect(card).not.toContainText(/26\s960/);
  await expect(card).not.toContainText(/16\s500/);
  await expect(card.getByLabel('Можно потратить')).toContainText('••••');
  await expect(card.getByLabel('Можно потратить')).not.toContainText(/10\s460/);
  await expect(page.getByRole('button', { name: /^MBank: ••••\. Открыть счёт$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Показать суммы' })).toHaveAttribute('aria-pressed', 'true');

  // Открыли приложение заново — суммы так и скрыты.
  await page.reload();
  await expect(page.getByLabel('Остаток')).toContainText('••••');
  await expect(page.getByLabel('Остаток')).not.toContainText(/26\s960/);

  // «Деньги»: итоги скрыты, записи истории видны.
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  const totals = page.getByLabel('Итоги месяца');
  await expect(totals).toContainText('••••');
  await expect(totals).not.toContainText(/26\s960/);
  await expect(totals).not.toContainText(/640/);
  // Записи истории видны (порядок двух трат одного дня не важен).
  await expect(page.locator('main').getByRole('button', { name: /Кафе.*400/ })).toBeVisible();
  await expect(page.locator('main').getByRole('button', { name: /Кафе.*240/ })).toBeVisible();

  // Глаз в «Деньгах» показывает суммы снова — везде.
  await page.getByRole('button', { name: 'Показать суммы' }).click();
  await expect(totals).toContainText(/26\s960/);
  await page.getByRole('navigation').getByRole('button', { name: 'Сегодня' }).click();
  await expect(page.getByLabel('Остаток')).toContainText(/26\s960/);
});
