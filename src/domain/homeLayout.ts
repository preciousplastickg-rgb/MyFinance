import type { HomeLayout, Settings } from './types';

/**
 * Разделы главной «Сегодня» (по просьбе пользователя, 2026-11-09, SPEC 5.1a): порядок и видимость выбирает пользователь
 * на экране «Главный экран». В данных — смысловые ключи, не вид. Плашка бэкапа в список не входит: она всегда сверху.
 */
export const HOME_BLOCKS = ['money', 'accounts', 'goals', 'savings', 'debts', 'limits', 'payments', 'tasks', 'habits'] as const;
export type HomeBlockId = (typeof HOME_BLOCKS)[number];

export const HOME_BLOCK_NAMES: Record<HomeBlockId, string> = {
  money: 'Остаток',
  accounts: 'Счета',
  goals: 'Цели',
  savings: 'Копилка',
  debts: 'Долги',
  limits: 'Лимиты',
  payments: 'Ближайшие платежи',
  tasks: 'Дела',
  habits: 'Привычки',
};

/** Когда раздел появляется сам (раздел без данных не показывается — принцип «пустое не показывается»). */
export const HOME_BLOCK_HINTS: Record<HomeBlockId, string> = {
  money: 'Остаток и «Можно потратить»',
  accounts: 'Все счета и сумма',
  goals: 'Когда есть цели',
  savings: 'Копилки, без них — «Завести»',
  debts: 'Когда есть долги',
  limits: 'Когда лимит на исходе',
  payments: 'Когда срок платежа подошёл',
  tasks: 'Сегодня и завтра',
  habits: 'Когда есть привычки',
};

export interface HomeBlock {
  id: HomeBlockId;
  visible: boolean;
}

const isBlock = (id: string): id is HomeBlockId => (HOME_BLOCKS as readonly string[]).includes(id);

/**
 * Разделы главной по порядку. Сохранённый порядок чистится: чужие ключи (из бэкапа будущей версии) и повторы отбрасываются;
 * раздел, которого в сохранённом порядке нет (появился в новой версии), встаёт после своего соседа по порядку по умолчанию.
 */
export function homeLayoutOf(settings: Pick<Settings, 'homeLayout'>): HomeBlock[] {
  const saved = settings.homeLayout;
  const hidden = new Set(saved?.hidden ?? []);
  const order: HomeBlockId[] = [];
  for (const id of saved?.order ?? []) if (isBlock(id) && !order.includes(id)) order.push(id);
  HOME_BLOCKS.forEach((id, i) => {
    if (order.includes(id)) return;
    // Ближайший предшественник по умолчанию, который уже стоит в порядке; нет такого — в начало.
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = order.indexOf(HOME_BLOCKS[j]!);
      if (k >= 0) {
        at = k + 1;
        break;
      }
    }
    order.splice(at, 0, id);
  });
  return order.map((id) => ({ id, visible: !hidden.has(id) }));
}

/** Сохраняемый вид раскладки. Совпадает с умолчанием — undefined (в настройках ничего лишнего). */
export function toHomeLayout(blocks: readonly HomeBlock[]): HomeLayout | undefined {
  const order = blocks.map((b) => b.id);
  const hidden = blocks.filter((b) => !b.visible).map((b) => b.id);
  const isDefault = !hidden.length && order.every((id, i) => id === HOME_BLOCKS[i]);
  return isDefault ? undefined : { order, hidden };
}

/** Новый порядок (ids — как отдал список с перетаскиванием); видимость не меняется. */
export function reorderHome(blocks: readonly HomeBlock[], ids: readonly string[]): HomeBlock[] {
  const byId = new Map(blocks.map((b) => [b.id as string, b]));
  const next = ids.map((id) => byId.get(id)).filter((b): b is HomeBlock => !!b);
  // Перестраховка: что не пришло в ids — в конец, ничего не теряется.
  for (const b of blocks) if (!next.includes(b)) next.push(b);
  return next;
}

export function setHomeVisible(blocks: readonly HomeBlock[], id: HomeBlockId, visible: boolean): HomeBlock[] {
  return blocks.map((b) => (b.id === id ? { ...b, visible } : b));
}

/** Подпись строки в настройках: «7 из 9» или «все». */
export function homeLayoutSummary(blocks: readonly HomeBlock[]): string {
  const shown = blocks.filter((b) => b.visible).length;
  return shown === blocks.length ? 'все разделы' : `${shown} из ${blocks.length}`;
}
