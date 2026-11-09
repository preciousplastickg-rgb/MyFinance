import { describe, expect, it } from 'vitest';
import { HOME_BLOCKS, homeLayoutOf, homeLayoutSummary, reorderHome, setHomeVisible, toHomeLayout } from './homeLayout';

const ids = (blocks: { id: string }[]) => blocks.map((b) => b.id);

describe('homeLayoutOf — разделы главной по порядку', () => {
  it('без настройки — порядок по умолчанию, всё видно', () => {
    const blocks = homeLayoutOf({});
    expect(ids(blocks)).toEqual([...HOME_BLOCKS]);
    expect(blocks.every((b) => b.visible)).toBe(true);
  });

  it('сохранённый порядок и скрытые разделы', () => {
    const order = ['tasks', 'money', 'accounts', 'goals', 'savings', 'debts', 'limits', 'payments', 'habits'];
    const blocks = homeLayoutOf({ homeLayout: { order, hidden: ['habits', 'savings'] } });
    expect(ids(blocks)).toEqual(order);
    expect(blocks.filter((b) => !b.visible).map((b) => b.id)).toEqual(['savings', 'habits']);
  });

  it('чужие ключи и повторы отбрасываются', () => {
    const blocks = homeLayoutOf({
      homeLayout: { order: ['habits', 'weather', 'habits', ...HOME_BLOCKS], hidden: ['weather'] },
    });
    expect(ids(blocks)).toEqual(['habits', ...HOME_BLOCKS.filter((id) => id !== 'habits')]);
    expect(blocks.every((b) => b.visible)).toBe(true);
  });

  it('раздела нет в сохранённом порядке (новая версия) — встаёт после своего соседа по умолчанию', () => {
    // Сохранили до появления «Лимитов» и «Целей»; «Дела» пользователь поднял наверх.
    const blocks = homeLayoutOf({
      homeLayout: { order: ['tasks', 'money', 'accounts', 'savings', 'debts', 'payments', 'habits'], hidden: [] },
    });
    expect(ids(blocks)).toEqual(['tasks', 'money', 'accounts', 'goals', 'savings', 'debts', 'limits', 'payments', 'habits']);
  });

  it('нет и первого раздела по умолчанию — он встаёт в начало', () => {
    const blocks = homeLayoutOf({ homeLayout: { order: ['habits', 'tasks'], hidden: [] } });
    expect(ids(blocks).slice(0, 3)).toEqual(['money', 'accounts', 'goals']);
    expect(ids(blocks)).toHaveLength(HOME_BLOCKS.length);
  });
});

describe('правка раскладки', () => {
  it('reorderHome — новый порядок, видимость сохраняется; потерянные ids не пропадают', () => {
    const start = setHomeVisible(homeLayoutOf({}), 'debts', false);
    const moved = reorderHome(start, ['habits', 'money', 'debts']);
    expect(ids(moved).slice(0, 3)).toEqual(['habits', 'money', 'debts']);
    expect(moved).toHaveLength(HOME_BLOCKS.length);
    expect(moved.find((b) => b.id === 'debts')?.visible).toBe(false);
  });

  it('toHomeLayout — умолчание не сохраняется, иначе порядок и скрытые', () => {
    expect(toHomeLayout(homeLayoutOf({}))).toBeUndefined();
    const hidden = setHomeVisible(homeLayoutOf({}), 'habits', false);
    expect(toHomeLayout(hidden)).toEqual({ order: [...HOME_BLOCKS], hidden: ['habits'] });
    const back = setHomeVisible(hidden, 'habits', true);
    expect(toHomeLayout(back)).toBeUndefined();
  });

  it('туда и обратно через настройки — та же раскладка', () => {
    const edited = setHomeVisible(reorderHome(homeLayoutOf({}), ['payments', 'tasks']), 'goals', false);
    expect(homeLayoutOf({ homeLayout: toHomeLayout(edited) })).toEqual(edited);
  });

  it('подпись — «все разделы» или «N из M»', () => {
    expect(homeLayoutSummary(homeLayoutOf({}))).toBe('все разделы');
    expect(homeLayoutSummary(setHomeVisible(homeLayoutOf({}), 'limits', false))).toBe('8 из 9');
  });
});
