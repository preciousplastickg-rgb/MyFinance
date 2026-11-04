import type { FinanceDB } from '../db/db';
import { toLocalDate } from '../domain/date';
import { generateSeed } from './seedData';

/** Заменяет все данные тестовыми (только dev: `npm run seed`). */
export async function seedDatabase(db: FinanceDB): Promise<void> {
  const data = generateSeed(toLocalDate(Date.now()));
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.accounts.bulkAdd(data.accounts);
    await db.categories.bulkAdd(data.categories);
    await db.transactions.bulkAdd(data.transactions);
    await db.recurring.bulkAdd(data.recurring);
    await db.occurrenceLog.bulkAdd(data.occurrenceLog);
    await db.settings.put(data.settings);
  });
}
