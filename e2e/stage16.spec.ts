import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('трата 20 USD с MBank: курс вводится один раз, дальше подставляется сам (приёмка этапа 16)', async ({ page }) => {
  await onboard(page);
  const plus = page.getByRole('navigation').getByRole('button', { name: 'Новая запись' });
  await plus.click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  await d.getByRole('button', { name: 'Валюта: Кыргызский сом' }).click();
  await page.getByRole('dialog', { name: 'Валюта' }).getByRole('button', { name: /^USD Доллар/ }).click();
  await d.getByRole('button', { name: '2', exact: true }).click();
  await d.getByRole('button', { name: '0', exact: true }).click();
  await d.getByRole('radio', { name: 'Кафе' }).click();
  // Курса USD ещё нет — «Сохранить» просит его.
  await d.getByRole('button', { name: 'Сохранить' }).click();
  const rate = page.getByRole('dialog', { name: 'Курс USD' });
  await rate.getByLabel('Сом за 1 USD').fill('87,50');
  await rate.getByRole('button', { name: 'Сохранить' }).click();
  await expect(d.getByRole('button', { name: 'Курс USD: 87,50. Изменить' })).toContainText('= 1 750 сом с MBank');
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(d).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^MBank: 18\s250\sсом/ })).toBeVisible();

  // Вторая трата в долларах: курс подставился сам.
  await plus.click();
  await d.getByRole('button', { name: 'Валюта: Кыргызский сом' }).click();
  await page.getByRole('dialog', { name: 'Валюта' }).getByRole('button', { name: /^USD Доллар/ }).click();
  await d.getByRole('button', { name: '1', exact: true }).click();
  await d.getByRole('button', { name: '0', exact: true }).click();
  await expect(d.getByRole('button', { name: 'Курс USD: 87,50. Изменить' })).toContainText('= 875 сом с MBank');
  await d.getByRole('radio', { name: 'Кафе' }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('button', { name: /^MBank: 17\s375\sсом/ })).toBeVisible();

  // В истории — сумма счёта и под ней доллары.
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  const row = page.locator('main').getByRole('button', { name: /Кафе.*−1\s750.*20 USD/ });
  await expect(row).toBeVisible();
  // Правка сохраняет валюту и курс.
  await row.click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Валюта: Доллар США' })).toBeVisible();
});
