import type { Category, Id } from './types';

const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });

/**
 * Новая категория встаёт по алфавиту среди своих (этап 29): перед первой категорией того же вида, чьё название по алфавиту
 * позже, иначе — после последней своего вида. Порядок остальных не меняется, даже если его переставляли руками.
 * Возвращает id всех категорий в новом порядке: sortOrder = место в списке.
 */
export function alphabeticalOrder(all: readonly Category[], added: Pick<Category, 'id' | 'name' | 'kind'>): Id[] {
  const ordered = [...all].filter((c) => c.id !== added.id).sort((a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : 1));
  const before = ordered.findIndex((c) => c.kind === added.kind && !c.archived && collator.compare(c.name, added.name) > 0);
  let at = before;
  if (at < 0) {
    const lastOfKind = ordered.map((c) => c.kind === added.kind).lastIndexOf(true);
    at = lastOfKind < 0 ? ordered.length : lastOfKind + 1;
  }
  const ids = ordered.map((c) => c.id);
  ids.splice(at, 0, added.id);
  return ids;
}
