import { describe, expect, it } from 'vitest';

// SPEC 9c: размеры текста — только токены шкалы, веса 400/500/600. Тест ловит возврат «text-[13px]» и «font-bold».
const sources = Object.entries(import.meta.glob<string>('../**/*.tsx', { query: '?raw', import: 'default', eager: true }));

describe('шкала текста (SPEC 9c)', () => {
  it('файлы найдены', () => {
    expect(sources.length).toBeGreaterThan(50);
  });
  it('нет произвольных размеров text-[Npx]', () => {
    expect(sources.filter(([, s]) => /text-\[\d+px\]/.test(s)).map(([f]) => f)).toEqual([]);
  });
  it('нет font-bold', () => {
    expect(sources.filter(([, s]) => /\bfont-bold\b/.test(s)).map(([f]) => f)).toEqual([]);
  });
});
