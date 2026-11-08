import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('копилка: завести фонд с целью, пополнить переводом; на «Сегодня» — итог и прогресс (приёмка этапа 20)', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Копилка: завести' }).click();
  await expect(page.getByRole('heading', { name: 'Копилка', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Новая копилка' }).click();
  const editor = page.getByRole('dialog', { name: 'Новая копилка' });
  await editor.getByLabel('Название').fill('Фонд обучения');
  await editor.getByRole('radio', { name: 'Фонд' }).click();
  await editor.getByLabel(/^Уже есть/).fill('10 000');
  await editor.getByLabel(/^Цель/).fill('100 000');
  await editor.getByRole('button', { name: 'Сохранить' }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Фонд обучения.*10% из 100\s000/ })).toBeVisible();

  // Пополнить: обычный перевод с MBank в копилку.
  await page.getByRole('button', { name: /^Фонд обучения/ }).click();
  await page.getByRole('dialog', { name: 'Фонд обучения' }).getByRole('button', { name: 'Пополнить' }).click();
  const entry = page.getByRole('dialog', { name: 'Новая запись' });
  await expect(entry.getByRole('button', { name: 'Откуда: MBank' })).toBeVisible();
  await expect(entry.getByRole('button', { name: 'Куда: Фонд обучения' })).toBeVisible();
  for (const k of ['5', '0', '00']) await entry.getByRole('button', { name: k, exact: true }).click();
  await entry.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('button', { name: /Фонд обучения.*15% из 100\s000/ })).toBeVisible();

  // «Сегодня»: копилка своим блоком, в «Счетах» её нет, лимит её не считает.
  await page.getByRole('button', { name: /Назад|Деньги|Сегодня/ }).first().click();
  await page.getByRole('navigation').getByRole('button', { name: 'Сегодня' }).click();
  const jars = page.getByRole('list', { name: 'Копилка' });
  await expect(jars).toContainText(/Всего накоплено1 копилка15\s000\sсом/);
  await page.getByRole('button', { name: 'Показать копилку' }).click();
  await expect(jars.getByRole('button', { name: /Фонд обучения: 15\s000\sсом/ })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Счета' })).not.toContainText('Фонд обучения');
  await expect(page.getByRole('button', { name: /^MBank: 15\s000\sсом/ })).toBeVisible();
});

test('долги на «Сегодня» — как счета: итог, раскрываются, карточка открывается', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await page.getByRole('button', { name: /^Долги/ }).click();
  await page.getByRole('button', { name: 'Дал в долг' }).click();
  const editor = page.getByRole('dialog', { name: 'Новый долг' });
  await editor.getByRole('textbox', { name: 'Кто должен' }).fill('Азамат');
  await editor.getByLabel(/^Сумма/).fill('3 000');
  await editor.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByRole('button', { name: /Назад|Деньги/ }).first().click();
  await page.getByRole('navigation').getByRole('button', { name: 'Сегодня' }).click();

  const block = page.getByRole('list', { name: 'Долги' });
  await expect(block).toContainText(/мне 3\s000\sсом/);
  await page.getByRole('button', { name: 'Показать долги' }).click();
  await block.getByRole('button', { name: /Азамат/ }).click();
  await expect(page.getByRole('dialog', { name: 'Азамат' })).toContainText('Должен вам');
});

test('расходы по категориям (этап 30 — «Куда ушли деньги» вместо кольца): тап по сегменту полосы раскрывает категорию', async ({ page }) => {
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Новая запись' }).click();
  const d = page.getByRole('dialog', { name: 'Новая запись' });
  for (const k of ['4', '00']) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('radio', { name: 'Кафе' }).click();
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Отчёты' }).click();
  const rating = page.getByRole('region', { name: 'Куда ушли деньги' });
  // Тост «Кафе −400 · Отменить» стоит над разделами внизу (этап 29) и может закрыть полосу — ждём, пока уйдёт.
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 7000 });
  // Одна категория — полоса целиком её: тап по середине полосы раскрывает «Кафе». Полоса — посреди экрана, а не под
  // панелью разделов внизу.
  const bar = rating.locator('[aria-hidden="true"]').first();
  await bar.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const box = (await bar.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(rating.getByRole('button', { name: /^Кафе/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(rating).toContainText('100% всех расходов');
  await rating.getByRole('button', { name: 'Все операции' }).click();
  await expect(page.getByRole('dialog', { name: 'Кафе' })).toBeVisible();
});
