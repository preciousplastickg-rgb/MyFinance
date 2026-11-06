import * as lucide from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { BASE_AREAS, BASE_CATEGORIES, DEFAULT_ACCOUNTS, ICON_NAMES, PALETTE, searchIcons, tint } from './catalog';

describe('каталог', () => {
  it('около 60 значков, все есть в lucide-react', () => {
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(60);
    const all = new Set(Object.keys(lucide));
    const used = [
      ...ICON_NAMES,
      ...BASE_CATEGORIES.map((c) => c.icon),
      ...DEFAULT_ACCOUNTS.map((a) => a.icon),
      ...BASE_AREAS.map((a) => a.icon),
    ];
    expect(used.filter((n) => !all.has(n))).toEqual([]);
    expect(used.filter((n) => !ICON_NAMES.includes(n))).toEqual([]);
  });
  it('базовые категории из SPEC 5.5', () => {
    expect(BASE_CATEGORIES.filter((c) => c.kind === 'expense').map((c) => c.name)).toEqual([
      'Продукты', 'Кафе', 'Транспорт', 'Жильё', 'Связь и интернет', 'Подписки', 'Здоровье',
      'Одежда', 'Дом', 'Развлечения', 'Подарки', 'Комиссии', 'Прочее',
    ]);
    expect(BASE_CATEGORIES.filter((c) => c.kind === 'income').map((c) => c.name)).toEqual(['Зарплата', 'Подработка', 'Другое']);
    expect(BASE_CATEGORIES.every((c) => (PALETTE as readonly string[]).includes(c.color))).toBe(true);
  });
  it('USDT не входит в лимит на день', () => {
    expect(DEFAULT_ACCOUNTS.map((a) => [a.name, a.includeInDaily])).toEqual([
      ['MBank', true], ['О!Банк', true], ['Оптима', true], ['Наличные', true], ['USDT', false],
    ]);
  });
  it('поиск значков по-русски', () => {
    expect(searchIcons('такс')).toEqual(['CarTaxiFront']);
    expect(searchIcons('коммун')).toEqual(expect.arrayContaining(['Zap', 'Droplet', 'Flame']));
    expect(searchIcons('ёлки')).toEqual([]);
    expect(searchIcons('  ')).toHaveLength(ICON_NAMES.length);
  });
  it('фон кружка — 13% цвета токена, старый hex — как есть', () => {
    expect(tint('blue')).toBe('color-mix(in srgb, var(--c-blue) 13%, transparent)');
    expect(tint('#2448D6')).toBe('color-mix(in srgb, #2448D6 13%, transparent)');
  });
});
