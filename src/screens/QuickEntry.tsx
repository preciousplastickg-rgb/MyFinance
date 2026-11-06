import { useEffect, useMemo, useState } from 'react';
import { useNav, useToday } from '../app/nav';
import { saveTransaction, undoSave } from '../data/actions';
import { useData } from '../data/DataProvider';
import { BASE_CURRENCY } from '../domain/currency';
import { formatShortDate } from '../domain/date';
import { currencyLabel, formatAmount, formatMoney } from '../domain/money';
import { debtMoveTitle } from '../domain/debts';
import { matchingOccurrence, occurrences, type Occurrence } from '../domain/recurring';
import type { Debt, Transaction } from '../domain/types';
import { Button } from '../ui/controls';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { EntryForm } from './entry/EntryForm';

/** Быстрый ввод — полноэкранная модалка (SPEC 5.2). */
export function QuickEntry({ onClose }: { onClose: () => void }) {
  const { entry } = useNav();
  const { categoryById, accountById, debts, recurring, occurrenceLog } = useData();
  const toast = useToast();
  const today = useToday();
  const occ = useMemo(() => occurrences(recurring, occurrenceLog, today), [recurring, occurrenceLog, today]);
  // Трата похожа на ожидаемый регулярный платёж: спрашиваем, не он ли это, иначе лимит вычтет его дважды (SPEC 4.4).
  const [ask, setAsk] = useState<{ tx: Transaction; match: Occurrence } | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Форма закрывается только после записи в базу: если IndexedDB откажет, введённое не пропадёт.
  const saved = async (tx: Transaction, newDebt?: Debt, link?: Occurrence) => {
    if (!newDebt && !link) {
      const match = matchingOccurrence(tx, accountById.get(tx.accountId)?.currency ?? BASE_CURRENCY, occ);
      if (match) return setAsk({ tx, match });
    }
    let result;
    try {
      result = await saveTransaction(tx, true, newDebt, link ? { recurringId: link.recurring.id, dueDate: link.dueDate } : undefined);
    } catch (e) {
      toast({ message: `Не сохранилось: ${(e as Error).message}` });
      return;
    }
    onClose();
    const currency = accountById.get(tx.accountId)?.currency ?? BASE_CURRENCY;
    let message: string;
    if (tx.type === 'debt') {
      const debt = newDebt ?? debts.find((d) => d.id === tx.debtId);
      const title = debt ? `${debtMoveTitle(debt.direction, tx.flow ?? 'out')}: ${debt.person}` : 'Долг';
      message = `${title} ${tx.flow === 'in' ? '+' : '−'}${formatAmount(tx.amount)} ${currencyLabel(currency)}`;
    } else if (tx.type === 'transfer') {
      const toCurrency = (tx.toAccountId && accountById.get(tx.toAccountId)?.currency) || currency;
      message = `Перевод ${formatAmount(tx.amount)} ${currencyLabel(currency)} → ${formatAmount(tx.toAmount ?? tx.amount)} ${currencyLabel(toCurrency)}`;
    } else {
      const title = tx.categoryId ? categoryById.get(tx.categoryId)?.name : 'Запись';
      const sign = tx.type === 'expense' ? '−' : '+';
      message = `${link ? link.recurring.name : title} ${sign}${formatAmount(tx.amount)} ${currencyLabel(currency)}`;
    }
    toast({
      message,
      actionLabel: 'Отменить',
      onAction: () => void undoSave(result),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-entry-title"
      className="pt-safe pb-safe fixed inset-0 z-30 mx-auto flex max-w-lg flex-col bg-surface"
    >
      <div className="grid min-h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center px-4">
        <button type="button" onClick={onClose} className="min-h-11 justify-self-start pr-3 text-body font-medium text-accent">
          Отмена
        </button>
        <h2 id="quick-entry-title" className="text-h2 font-semibold">
          Новая запись
        </h2>
      </div>
      <EntryForm
        initialType={entry?.type ?? 'expense'}
        initialAccountId={entry?.accountId}
        initialToAccountId={entry?.toAccountId}
        initialDate={entry?.date}
        onSave={saved}
      />
      {ask && (
        <Sheet title={`Это оплата «${ask.match.recurring.name}»?`} onClose={() => setAsk(null)}>
          <div className="space-y-4">
            <p className="text-muted">
              {ask.match.recurring.kind === 'income' ? 'Ожидалось' : 'Срок'} {formatShortDate(ask.match.dueDate)} ·{' '}
              {formatMoney(ask.match.recurring.amount, ask.match.recurring.currency)}. Если да, платёж отметится как
              {ask.match.recurring.kind === 'income' ? ' пришедший' : ' оплаченный'}, и лимит на день не вычтет его второй раз.
            </p>
            <Button
              className="w-full"
              onClick={() => {
                const { tx, match } = ask;
                setAsk(null);
                void saved(tx, undefined, match);
              }}
            >
              Да, это он
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                const { tx } = ask;
                setAsk(null);
                void saveTransaction(tx, true).then((result) => {
                  onClose();
                  toast({
                    message: `${tx.categoryId ? categoryById.get(tx.categoryId)?.name : 'Запись'} ${tx.type === 'expense' ? '−' : '+'}${formatAmount(tx.amount)} ${currencyLabel(accountById.get(tx.accountId)?.currency ?? BASE_CURRENCY)}`,
                    actionLabel: 'Отменить',
                    onAction: () => void undoSave(result),
                  });
                });
              }}
            >
              Нет, обычная {ask.tx.type === 'income' ? 'запись' : 'трата'}
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
