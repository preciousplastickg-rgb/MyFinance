export type StorageState = 'persisted' | 'best-effort' | 'unsupported';

/**
 * Просит браузер не вычищать IndexedDB (SPEC 2). Повторный вызов безвреден:
 * если хранилище уже постоянное, persist() не вызывается.
 */
export async function requestPersistentStorage(
  storage: Partial<Pick<StorageManager, 'persist' | 'persisted'>> | undefined = globalThis.navigator?.storage,
): Promise<StorageState> {
  if (!storage?.persist || !storage.persisted) return 'unsupported';
  try {
    if (await storage.persisted()) return 'persisted';
    return (await storage.persist()) ? 'persisted' : 'best-effort';
  } catch {
    return 'best-effort';
  }
}
