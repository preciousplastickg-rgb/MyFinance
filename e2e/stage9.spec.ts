import { expect, test, type Page } from '@playwright/test';
import { onboard, screen } from './helpers';

const NOV_4 = new Date('2026-11-04T10:00:00+06:00');

async function addFromTemplate(page: Page, template: string) {
  await page.getByRole('button', { name: 'Добавить привычку' }).click();
  const sheet = page.getByRole('dialog', { name: 'Новая привычка' });
  await sheet.getByLabel('Шаблоны').getByRole('button', { name: template }).click();
  await sheet.getByRole('button', { name: 'Сохранить' }).click();
  await expect(sheet).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOV_4);
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Дела' }).click();
  await page.getByRole('radio', { name: 'Привычки' }).click();
});

test('галочка ставится и снимается тапом по дню недели, без «+1» и подтверждений', async ({ page }) => {
  await addFromTemplate(page, 'Вода');
  await expect(page.getByText('Каждый день · 2 литра')).toBeVisible();
  await expect(page.getByRole('button', { name: /Плюс один/ })).toHaveCount(0);
  const today = page.getByRole('button', { name: 'Вода, Ср 4 ноября' });
  await today.click();
  await expect(today).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('navigation').getByRole('button', { name: 'Сегодня' }).click();
  await expect(page.getByRole('button', { name: '1 из 1 сегодня' })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Дела' }).click();
  await today.click();
  await expect(today).toHaveAttribute('aria-pressed', 'false');
});

test('каждый день: прошлый день отмечается в неделе и в календаре, серия', async ({ page }) => {
  await addFromTemplate(page, 'Медитация');
  await page.getByRole('button', { name: 'Медитация, Ср 4 ноября' }).click();
  // Привычка начата сегодня — вчера недоступно; сдвинем старт и отметим вчера прямо в неделе.
  await page.getByRole('button', { name: /^Медитация Каждый день/ }).click();
  await page.getByRole('button', { name: 'Изменить привычку' }).click();
  await page.getByLabel('Начало').fill('2026-11-01');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  // После правки открывается карточка привычки, а не список — закрываем её.
  await page.getByRole('dialog', { name: 'Медитация' }).getByRole('button', { name: 'Закрыть' }).click();
  await page.getByRole('button', { name: 'Медитация, Вт 3 ноября' }).click();
  await expect(page.getByText('Каждый день · серия 2 дня')).toBeVisible();
  await page.getByRole('button', { name: /^Медитация Каждый день/ }).click();
  const detail = page.getByRole('dialog', { name: 'Медитация' });
  await detail.getByRole('button', { name: '2 ноября: не выполнено' }).click();
  await expect(detail.getByLabel('Серия: 3 дня')).toBeVisible();
});

test('по дням недели: спортзал пн/ср/пт, свои дни, отчёт', async ({ page }) => {
  await addFromTemplate(page, 'Спортзал');
  await expect(page.getByText('Пн, Ср, Пт', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Спортзал, Ср 4 ноября' }).click();
  await expect(page.getByRole('button', { name: 'Спортзал, Ср 4 ноября' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Добавить привычку' }).click();
  const sheet = page.getByRole('dialog', { name: 'Новая привычка' });
  await sheet.getByLabel('Название').fill('Растяжка');
  await sheet.getByRole('radio', { name: 'По дням недели' }).click();
  await expect(sheet.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  const days = sheet.getByLabel('Дни недели');
  await days.getByRole('button', { name: 'Вт' }).click();
  await days.getByRole('button', { name: 'Сб' }).click();
  await sheet.getByLabel('Подпись (необязательно)').fill('15 минут');
  await sheet.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Вт, Сб · 15 минут')).toBeVisible();
  // Сегодня среда — не по расписанию, но отметить можно.
  await expect(page.getByRole('button', { name: 'Растяжка, Ср 4 ноября, не по расписанию' })).toBeEnabled();

  await page.getByRole('navigation').getByRole('button', { name: 'Отчёты' }).click();
  await page.getByRole('radio', { name: 'Привычки' }).click();
  await expect(page.getByLabel('Привычки за 30 дней')).toBeVisible();
  await expect(screen(page).getByText('Спортзал')).toBeVisible();
});

test('порядок привычек меняется перетаскиванием за ручку', async ({ page }) => {
  for (const t of ['Спортзал', 'Вода', 'Медитация']) await addFromTemplate(page, t);
  const names = () => page.getByRole('group', { name: /^Неделя: / }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  await expect.poll(names).toEqual(['Неделя: Спортзал', 'Неделя: Вода', 'Неделя: Медитация']);
  const handle = (await page.getByRole('button', { name: 'Переместить Медитация' }).boundingBox())!;
  const gym = (await page.getByRole('button', { name: 'Переместить Спортзал' }).boundingBox())!;
  const x = handle.x + handle.width / 2;
  await page.mouse.move(x, handle.y + handle.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x, handle.y + handle.height / 2 + ((gym.y - handle.y) * i) / 10);
  await page.mouse.up();
  await expect.poll(names).toEqual(['Неделя: Медитация', 'Неделя: Спортзал', 'Неделя: Вода']);
  // Порядок сохраняется и на «Сегодня» (там привычки компактными строками).
  await page.getByRole('navigation').getByRole('button', { name: 'Сегодня' }).click();
  const todayNames = () => page.getByRole('list', { name: 'Привычки' }).getByRole('button', { name: /: отметить сегодня$/ }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  await expect.poll(todayNames).toEqual(['Медитация: отметить сегодня', 'Спортзал: отметить сегодня', 'Вода: отметить сегодня']);
});
