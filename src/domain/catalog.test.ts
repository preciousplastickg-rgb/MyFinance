import { describe, expect, it } from 'vitest';
import { DUOTONE } from '../ui/glyphs.gen';
import { BASE_AREAS, BASE_CATEGORIES, DEFAULT_ACCOUNTS, EMOJI, firstGrapheme, glyphName, ICON_NAMES, isEmoji, PALETTE, searchEmoji, searchIcons, tint } from './catalog';
import { GOAL_ICONS } from './goals';
import { HABIT_TEMPLATES } from './habits';
import { PURPOSES } from './savings';

describe('каталог', () => {
  it('около 200 значков, у каждого есть рисунок Phosphor duotone (scripts/gen-glyphs.mjs)', () => {
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(190);
    const used = [
      ...ICON_NAMES,
      ...BASE_CATEGORIES.map((c) => c.icon),
      ...DEFAULT_ACCOUNTS.map((a) => a.icon),
      ...BASE_AREAS.map((a) => a.icon),
      ...GOAL_ICONS,
      ...HABIT_TEMPLATES.map((h) => h.icon),
      ...Object.values(PURPOSES).map((p) => p.icon),
    ];
    // Значки из кода экранов (долг, перевод, поступление, «Без категории») в сетку не входят, но рисунок нужен.
    const code = ['HandCoins', 'ArrowLeftRight', 'TrendingUp', 'Repeat', 'Ellipsis', 'CalendarCheck', 'Target', 'Star', 'Coins', 'Package', 'Receipt', 'Shield', 'Palette', 'Flame'];
    expect([...used, ...code].filter((n) => !DUOTONE[glyphName(n)])).toEqual([]);
    expect(used.filter((n) => !ICON_NAMES.includes(n))).toEqual([]);
    // Один рисунок — один ключ: иначе в сетке два одинаковых значка.
    const glyphs = ICON_NAMES.map(glyphName);
    expect(glyphs.filter((g, i) => glyphs.indexOf(g) !== i)).toEqual([]);
  });
  it('старые ключи из базы (lucide) рисуются значками Phosphor', () => {
    expect(glyphName('Landmark')).toBe('Bank');
    expect(glyphName('Banknote')).toBe('Money');
    expect(glyphName('ShoppingCart')).toBe('ShoppingCart');
  });
  it('эмодзи: поиск по-русски, ключ значка не эмодзи, первая графема из ввода', () => {
    expect(EMOJI.length).toBeGreaterThanOrEqual(100);
    expect(searchEmoji('кофе')).toEqual(['☕']);
    expect(searchEmoji('')).toHaveLength(EMOJI.length);
    expect(isEmoji('ShoppingCart')).toBe(false);
    expect(isEmoji('🍔')).toBe(true);
    expect(isEmoji('✈️')).toBe(true);
    expect(firstGrapheme('  👨‍👩‍👧 семья')).toBe('👨‍👩‍👧');
    expect(firstGrapheme('')).toBe('');
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
