import { useData } from '../data/DataProvider';
import { currencyLabel, formatAmount } from '../domain/money';
import type { Transaction } from '../domain/types';
import { IconCircle } from './icons';
import { isBase } from '../domain/currency';
import { debtMoveTitle } from '../domain/debts';

/** Строка истории: значок, категория, «комментарий · счёт», сумма (SPEC 5.3). */
export function TransactionRow({ tx, onClick }: { tx: Transaction; onClick?: () => void }) {
  const { categoryById, accountById, debts } = useData();
  const account = accountById.get(tx.accountId);
  const foreign = account && !isBase(account.currency) ? ` ${currencyLabel(account.currency)}` : '';

  let icon = 'Ellipsis';
  let color = 'slate';
  let title = 'Без категории';
  let subtitle = [tx.note, account?.name].filter(Boolean).join(' · ');
  let amount: string;
  let amountClass = 'text-ink';
  // Платили в другой валюте (этап 16): под суммой счёта — сколько и в чём.
  const orig = tx.origAmount && tx.origCurrency ? `${formatAmount(tx.origAmount)} ${currencyLabel(tx.origCurrency)}` : undefined;

  if (tx.type === 'debt') {
    // Долг (этап 17): «Дал в долг · Азамат · MBank», деньги по счёту, но не доход и не расход.
    const debt = debts.find((d) => d.id === tx.debtId);
    icon = 'HandCoins';
    color = 'orange';
    title = debt ? debtMoveTitle(debt.direction, tx.flow ?? 'out') : 'Долг';
    subtitle = [debt?.person ?? tx.note, account?.name].filter(Boolean).join(' · ');
    amount = `${tx.flow === 'in' ? '+' : '−'}${formatAmount(tx.amount)}${foreign}`;
    amountClass = 'text-muted';
  } else if (tx.type === 'transfer') {
    const to = tx.toAccountId ? accountById.get(tx.toAccountId) : undefined;
    icon = 'ArrowLeftRight';
    title = 'Перевод';
    subtitle = [tx.note, `${account?.name ?? '?'} → ${to?.name ?? '?'}`].filter(Boolean).join(' · ');
    const toAmount = tx.toAmount ?? tx.amount;
    amount = toAmount === tx.amount && account?.currency === to?.currency ? formatAmount(tx.amount) : `${formatAmount(tx.amount)} → ${formatAmount(toAmount)}`;
    amountClass = 'text-muted';
  } else {
    const category = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
    if (category) {
      icon = category.icon;
      color = category.color;
      title = category.name;
    }
    amount = `${tx.type === 'expense' ? '−' : '+'}${formatAmount(tx.amount)}${foreign}`;
    if (tx.type === 'income') amountClass = 'text-income';
  }

  return (
    <button type="button" onClick={onClick} className="flex h-14 w-full items-center gap-3 px-4 text-left">
      <IconCircle name={icon} color={color} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-[12px] text-muted">{subtitle}</p>
      </div>
      <span className="shrink-0 text-right">
        <span className={`tabular block font-semibold ${amountClass}`}>{amount}</span>
        {orig && <span className="tabular block text-[12px] text-muted">{orig}</span>}
      </span>
    </button>
  );
}
