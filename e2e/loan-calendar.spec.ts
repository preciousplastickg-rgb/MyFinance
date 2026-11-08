import { expect, test, type Page } from '@playwright/test';
import { NOV_4, onboard } from './helpers';

/**
 * По просьбе пользователя (4.11): в календаре кредита или рассрочки отмечают оплаченные платежи — прошлые одной кнопкой,
 * без записи в «Деньгах»; после правки суммы остальные платежи пересчитываются — «Разделить остаток» (срок прежний)
 * или «Как в графике» (меняется срок), либо «Только этот месяц».
 */

async function newInstallment(page: Page, fields: { name: string; price: string; months: string; first?: string }) {
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await page.getByRole('button', { name: 'Регулярные' }).click();
  await page.getByRole('button', { name: 'Добавить кредит или рассрочку' }).click();
  await page.getByRole('dialog', { name: 'Новый кредит' }).getByRole('radio', { name: 'Рассрочка' }).click();
  const d = page.getByRole('dialog', { name: 'Новая рассрочка' });
  await d.getByLabel('Название').fill(fields.name);
  await d.getByLabel(/^Стоимость покупки/).fill(fields.price);
  await d.getByLabel('Срок, месяцев').fill(fields.months);
  if (fields.first) await d.getByLabel('Первый платёж').fill(fields.first);
  return d;
}

const amount = (n: number) => new RegExp(`^${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\\s')}$`);

test('прошлые платежи отмечаются оплаченными одной кнопкой и галочкой, без записи в «Деньгах»; отметки сохраняются', async ({ page }) => {
  await page.clock.setFixedTime(NOV_4);
  await onboard(page);
  // Первый платёж 4 сентября: сентябрь и октябрь уже прошли, 4 ноября — сегодня.
  const d = await newInstallment(page, { name: 'Телефон', price: '30 000', months: '3', first: '2026-09-04' });
  await expect(d.getByRole('checkbox', { name: 'Платёж 1 оплачен' })).not.toBeChecked();
  await d.getByRole('button', { name: /^Отметить прошедшие оплаченными · 2/ }).click();
  await expect(d.getByRole('checkbox', { name: 'Платёж 1 оплачен' })).toBeChecked();
  await expect(d.getByRole('checkbox', { name: 'Платёж 2 оплачен' })).toBeChecked();
  await expect(d.getByRole('checkbox', { name: 'Платёж 3 оплачен' })).not.toBeChecked();
  await expect(d.getByRole('button', { name: /^Отметить прошедшие/ })).toHaveCount(0);
  await expect(d.getByLabel('Итоги')).toContainText('Выплачено 2 из 3');
  await d.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('button', { name: /Телефон.*Рассрочка · 2 из 3/ })).toBeVisible();

  // Снять отметку галочкой — после сохранения выплачен один.
  await page.getByRole('button', { name: /Телефон.*Рассрочка/ }).click();
  const r = page.getByRole('dialog', { name: 'Рассрочка' });
  await expect(r.getByRole('checkbox', { name: 'Платёж 2 оплачен' })).toBeChecked();
  await r.getByRole('checkbox', { name: 'Платёж 2 оплачен' }).click();
  await expect(r.getByLabel('Итоги')).toContainText('Выплачено 1 из 3');
  await r.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('button', { name: /Телефон.*Рассрочка · 1 из 3/ })).toBeVisible();

  // Отметки не создают операций: деньги ушли раньше, остатки счетов их уже не содержат.
  const transactions = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('finance');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const count = open.result.transaction('transactions').objectStore('transactions').count();
          count.onsuccess = () => {
            resolve(count.result);
            open.result.close();
          };
        };
      }),
  );
  expect(transactions).toBe(0);
});

test('правка суммы платежа: «Разделить остаток», «Как в графике» и «Только этот месяц»', async ({ page }) => {
  await page.clock.setFixedTime(NOV_4);
  await onboard(page);
  const d = await newInstallment(page, { name: 'Ноутбук', price: '30 000', months: '3' });
  const sum = (n: number) => d.getByLabel(`Платёж ${n}: сумма`);
  const options = d.getByRole('group', { name: 'Остальные платежи' });
  await expect(options).toHaveCount(0);

  // 15 000 вместо 10 000: поровну — по 7 500, как в графике — последний 5 000.
  await sum(1).fill('15 000');
  await expect(options.getByRole('button', { name: /^Разделить остаток дальше по 7\s500$/ })).toBeVisible();
  await expect(options.getByRole('button', { name: /^Как в графике последний — 5\s000$/ })).toBeVisible();
  await options.getByRole('button', { name: /^Разделить остаток/ }).click();
  await expect(options).toHaveCount(0);
  await expect(sum(2)).toHaveValue(amount(7500));
  await expect(sum(3)).toHaveValue(amount(7500));

  // Первым платежом 20 000 при платежах 7 500: как в графике — 7 500 и последний 2 500.
  await sum(1).fill('20 000');
  await options.getByRole('button', { name: /^Как в графике/ }).click();
  await expect(sum(2)).toHaveValue(amount(7500));
  await expect(sum(3)).toHaveValue(amount(2500));

  // Вторым платежом весь остаток — долг закрыт, третьего платежа больше нет.
  await sum(2).fill('10 000');
  await expect(options.getByRole('button', { name: /^Как в графике долг закрыт$/ })).toBeVisible();
  await options.getByRole('button', { name: /^Как в графике/ }).click();
  await expect(d.getByLabel('Платёж 3: сумма')).toHaveCount(0);
  await expect(d.getByLabel('Итоги')).toContainText(/Всего выплатить\s*30\s000\sсом/);

  // «Только этот месяц» — остальные не трогаются.
  await sum(2).fill('9 000');
  await options.getByRole('button', { name: 'Только этот месяц' }).click();
  await expect(options).toHaveCount(0);
  await expect(sum(1)).toHaveValue(amount(20000));
  await expect(d.getByLabel('Итоги')).toContainText(/Всего выплатить\s*29\s000\sсом/);
});

test('кредит 100 000 на 12 мес. под 24 %: 20 000 первым платежом — дальше по 8 378,59 или срок на месяц короче', async ({ page }) => {
  await page.clock.setFixedTime(NOV_4);
  await onboard(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Деньги' }).click();
  await page.getByRole('button', { name: 'Регулярные' }).click();
  await page.getByRole('button', { name: 'Добавить кредит или рассрочку' }).click();
  const d = page.getByRole('dialog', { name: 'Новый кредит' });
  await d.getByLabel('Название').fill('Кредит на ремонт');
  await d.getByLabel(/^Сумма кредита/).fill('100 000');
  await d.getByLabel('Срок, месяцев').fill('12');
  await d.getByLabel('Ставка, % годовых').fill('24');
  await d.getByLabel('Платёж 1: сумма').fill('20 000');
  const options = d.getByRole('group', { name: 'Остальные платежи' });
  // Остаток долга 100 000 + 2 000 % − 20 000 = 82 000 на 11 месяцев — как пересчитает банк.
  await expect(options.getByRole('button', { name: /^Разделить остаток дальше по 8\s378,59$/ })).toBeVisible();
  await expect(options.getByRole('button', { name: /^Как в графике срок на 1 мес\. короче$/ })).toBeVisible();
  await options.getByRole('button', { name: /^Как в графике/ }).click();
  await expect(d.getByLabel('Платёж 11: сумма')).toBeVisible();
  await expect(d.getByLabel('Платёж 12: сумма')).toHaveCount(0);
  await expect(d.getByLabel('Платёж 10: сумма')).toHaveValue(/^9\s455,96$/);
});
