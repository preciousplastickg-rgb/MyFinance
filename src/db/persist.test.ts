import { describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './persist';

describe('requestPersistentStorage', () => {
  it('не вызывает persist(), если уже постоянное', async () => {
    const persist = vi.fn(async () => true);
    const state = await requestPersistentStorage({ persisted: async () => true, persist });
    expect(state).toBe('persisted');
    expect(persist).not.toHaveBeenCalled();
  });

  it('просит постоянное хранилище при первом запуске', async () => {
    const persist = vi.fn(async () => true);
    expect(await requestPersistentStorage({ persisted: async () => false, persist })).toBe('persisted');
    expect(persist).toHaveBeenCalledOnce();
  });

  it('браузер отказал — best-effort', async () => {
    expect(
      await requestPersistentStorage({ persisted: async () => false, persist: async () => false }),
    ).toBe('best-effort');
  });

  it('нет Storage API — unsupported', async () => {
    expect(await requestPersistentStorage({})).toBe('unsupported');
  });
});
