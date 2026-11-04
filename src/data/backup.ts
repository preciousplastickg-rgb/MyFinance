import { db } from '../db';
import { DEFAULT_SETTINGS, ensureBaseCategories, ensureSettings, type FinanceDB } from '../db/db';
import { backupFileName, buildBackup, TABLE_NAMES, transactionsCsv, type Backup, type BackupTables } from '../domain/backup';
import { toLocalDate } from '../domain/date';

export async function exportAll(database: FinanceDB = db): Promise<Backup> {
  const data = await database.transaction('r', database.tables, async () => {
    const entries = await Promise.all(TABLE_NAMES.map(async (name) => [name, await database.table(name).toArray()] as const));
    return Object.fromEntries(entries) as unknown as BackupTables;
  });
  return buildBackup(data, Date.now());
}

/** «Заменить всё» одной транзакцией Dexie (SPEC 8). */
export async function replaceAll(backup: Backup, database: FinanceDB = db): Promise<void> {
  await database.transaction('rw', database.tables, async () => {
    for (const name of TABLE_NAMES) {
      await database.table(name).clear();
      const rows = backup.data[name];
      if (rows.length) await database.table(name).bulkAdd(rows);
    }
    if (!(await database.settings.get('main'))) await database.settings.add(DEFAULT_SETTINGS);
  });
}

export async function deleteAll(database: FinanceDB = db): Promise<void> {
  await database.transaction('rw', database.tables, async () => {
    for (const t of database.tables) await t.clear();
  });
  await ensureSettings(database);
  await ensureBaseCategories(database);
}

/**
 * Отдаёт файл через меню iOS «Поделиться» → «Сохранить в Файлы»; без Web Share с файлами — скачивание ссылкой.
 * false — пользователь закрыл меню.
 */
export async function shareFile(content: string, name: string, type: string): Promise<boolean> {
  const file = new File([content], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      const name = (e as DOMException).name;
      if (name === 'AbortError') return false;
      // iOS не открывает меню, если жест пользователя «истёк» за время чтения базы — тогда скачиваем ссылкой.
      if (name !== 'NotAllowedError') throw e;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/** Экспорт JSON; после успеха обновляется lastBackupAt. */
export async function saveBackup(): Promise<boolean> {
  const backup = await exportAll();
  const ok = await shareFile(JSON.stringify(backup), backupFileName(toLocalDate(backup.exportedAt)), 'application/json');
  if (ok) await db.settings.update('main', { lastBackupAt: Date.now() });
  return ok;
}

export async function saveCsv(): Promise<boolean> {
  const [transactions, accounts, categories] = await Promise.all([db.transactions.toArray(), db.accounts.toArray(), db.categories.toArray()]);
  return shareFile(transactionsCsv(transactions, accounts, categories), `finance-operations-${toLocalDate(Date.now())}.csv`, 'text/csv');
}

export async function hasData(): Promise<boolean> {
  return (await db.transactions.count()) > 0 || (await db.accounts.count()) > 0 || (await db.tasks.count()) > 0;
}
