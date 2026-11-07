import { describe, expect, it } from 'vitest';
import { alphabeticalOrder } from './categories';
import type { Category } from './types';

const cat = (id: string, name: string, sortOrder: number, extra: Partial<Category> = {}): Category => ({
  id, name, kind: 'expense', icon: 'Ellipsis', color: 'slate', isFixed: false, sortOrder, archived: false, ...extra,
});

describe('новая категория по алфавиту (этап 29)', () => {
  const all = [cat('a', 'Аптека', 0), cat('k', 'Кафе', 1), cat('t', 'Транспорт', 2), cat('z', 'Зарплата', 3, { kind: 'income' })];

  it('встаёт перед первой своего вида, что позже по алфавиту', () => {
    expect(alphabeticalOrder(all, { id: 'n', name: 'Книги', kind: 'expense' })).toEqual(['a', 'k', 'n', 't', 'z']);
    expect(alphabeticalOrder(all, { id: 'n', name: 'авто', kind: 'expense' })).toEqual(['n', 'a', 'k', 't', 'z']); // регистр не важен: «ав» < «ап»
    expect(alphabeticalOrder(all, { id: 'n', name: 'Ёлка', kind: 'expense' })).toEqual(['a', 'n', 'k', 't', 'z']);
  });
  it('позже всех своего вида — после последней своего вида, доходы не трогаются', () => {
    expect(alphabeticalOrder(all, { id: 'n', name: 'Юрист', kind: 'expense' })).toEqual(['a', 'k', 't', 'n', 'z']);
    expect(alphabeticalOrder(all, { id: 'n', name: 'Аванс', kind: 'income' })).toEqual(['a', 'k', 't', 'n', 'z']);
    expect(alphabeticalOrder(all, { id: 'n', name: 'Фриланс', kind: 'income' })).toEqual(['a', 'k', 't', 'z', 'n']);
  });
  it('архивные не мешают, свой порядок остальных сохраняется', () => {
    const custom = [cat('t', 'Транспорт', 0), cat('a', 'Аптека', 1), cat('x', 'Бар', 2, { archived: true })];
    expect(alphabeticalOrder(custom, { id: 'n', name: 'Вода', kind: 'expense' })).toEqual(['n', 't', 'a', 'x']);
  });
});
