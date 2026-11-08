import { isBase } from './currency';
import { toKgs } from './rate';
import type { Currency, Debt, Id, LocalDate, Minor, Rate, Transaction } from './types';

export type DebtMoveKind = 'grow' | 'repay';

/**
 * Куда идут деньги: «мне должны» — дал в долг (out), вернули (in); «я должен» — взял (in), вернул (out).
 */
export function debtFlow(direction: Debt['direction'], kind: DebtMoveKind): 'out' | 'in' {
  const grow = direction === 'owedToMe' ? 'out' : 'in';
  return kind === 'grow' ? grow : grow === 'out' ? 'in' : 'out';
}

export function moveKind(direction: Debt['direction'], flow: 'out' | 'in'): DebtMoveKind {
  return debtFlow(direction, 'grow') === flow ? 'grow' : 'repay';
}

/** Подпись операции в истории: «Дал в долг», «Вернули долг», «Взял в долг», «Вернул долг». */
export function debtMoveTitle(direction: Debt['direction'], flow: 'out' | 'in'): string {
  const kind = moveKind(direction, flow);
  if (direction === 'owedToMe') return kind === 'grow' ? 'Дал в долг' : 'Вернули долг';
  return kind === 'grow' ? 'Взял в долг' : 'Вернул долг';
}

export interface DebtState {
  debt: Debt;
  /** Сколько всего было в долг: начальная сумма + рост. */
  total: Minor;
  repaid: Minor;
  remaining: Minor;
  closed: boolean;
  overdue: boolean;
  /** Операции долга по датам, новые сверху. */
  moves: Transaction[];
}

export function debtState(debt: Debt, transactions: readonly Transaction[], today: LocalDate): DebtState {
  const moves = transactions
    .filter((t) => t.type === 'debt' && t.debtId === debt.id)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  let total = debt.opening;
  let repaid = 0;
  for (const t of moves) {
    if (moveKind(debt.direction, t.flow ?? 'out') === 'grow') total += t.amount;
    else repaid += t.amount;
  }
  const remaining = Math.max(0, total - repaid);
  const closed = !!debt.closedAt || remaining === 0;
  const overdue = !closed && !!debt.dueDate && debt.dueDate < today;
  return { debt, total, repaid, remaining, closed, overdue, moves };
}

export interface DebtsOverview {
  owedToMe: DebtState[];
  iOwe: DebtState[];
  closed: DebtState[];
  /** Открытые остатки по валютам. */
  totals: { owedToMe: Map<Currency, Minor>; iOwe: Map<Currency, Minor> };
}

/** Списки «Мне должны» / «Я должен» (сначала просроченные, потом по сроку, без срока — в конце) и закрытые. */
export function debtsOverview(debts: readonly Debt[], transactions: readonly Transaction[], today: LocalDate): DebtsOverview {
  // Операции долгов раскладываются по долгам за один проход, а не проходом по всей истории на каждый долг.
  const byDebt = new Map<Id, Transaction[]>();
  for (const t of transactions) {
    if (t.type !== 'debt' || !t.debtId) continue;
    const list = byDebt.get(t.debtId);
    if (list) list.push(t);
    else byDebt.set(t.debtId, [t]);
  }
  // Пустой долг — без суммы «без счёта» и без единой операции: его запись удалили в «Деньгах» до того, как удаление
  // стало убирать и долг (по замечанию пользователя). Такого долга нет — в списках его не показываем.
  const states = debts.filter((d) => d.opening !== 0 || byDebt.has(d.id)).map((d) => debtState(d, byDebt.get(d.id) ?? [], today));
  const order = (a: DebtState, b: DebtState) => {
    const da = a.debt.dueDate ?? '9999';
    const db = b.debt.dueDate ?? '9999';
    return da < db ? -1 : da > db ? 1 : b.debt.createdAt - a.debt.createdAt;
  };
  const open = states.filter((s) => !s.closed).sort(order);
  const totals = { owedToMe: new Map<Currency, Minor>(), iOwe: new Map<Currency, Minor>() };
  for (const s of open) {
    const m = totals[s.debt.direction];
    m.set(s.debt.currency, (m.get(s.debt.currency) ?? 0) + s.remaining);
  }
  return {
    owedToMe: open.filter((s) => s.debt.direction === 'owedToMe'),
    iOwe: open.filter((s) => s.debt.direction === 'iOwe'),
    closed: states.filter((s) => s.closed).sort((a, b) => b.debt.createdAt - a.debt.createdAt),
    totals,
  };
}

/** Итог по валютам в сомах: сом как есть, валюта — по последнему курсу; без курса не считается. */
export function totalKgs(byCurrency: ReadonlyMap<Currency, Minor>, rateFor: (c: Currency) => Rate | undefined): Minor {
  let sum = 0;
  for (const [c, v] of byCurrency) {
    if (isBase(c)) sum += v;
    else {
      const r = rateFor(c);
      if (r) sum += toKgs(v, r);
    }
  }
  return sum;
}

/**
 * Операция, с которой долг начался (самая ранняя «дал / взял»), — её сумма правится в редакторе долга.
 * У долга без счёта такой операции нет: его сумма — opening.
 */
export function openingMove(debt: Debt, transactions: readonly Transaction[]): Transaction | undefined {
  const grow = debtFlow(debt.direction, 'grow');
  return transactions
    .filter((t) => t.type === 'debt' && t.debtId === debt.id && (t.flow ?? 'out') === grow)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt))[0];
}

/** Категория «Долг» (своя, по названию: «Долг», «Долги», «Займ»): запись с ней уходит в «Долги» (этап 19). */
export function isDebtCategory(category: { name: string } | undefined): boolean {
  return !!category && /долг|займ/i.test(category.name);
}

/**
 * Что значит запись с категорией «Долг»: расход — «дал в долг» или «вернул долг»,
 * доход — «взял в долг» или «мне вернули». Направление долга по виду записи и выбору.
 */
export function debtDirectionFor(type: 'expense' | 'income', kind: DebtMoveKind): Debt['direction'] {
  if (type === 'expense') return kind === 'grow' ? 'owedToMe' : 'iOwe';
  return kind === 'grow' ? 'iOwe' : 'owedToMe';
}

