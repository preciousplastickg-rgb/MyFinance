import { useEffect } from 'react';
import { useNav } from '../app/nav';
import { saveTransaction, undoSave } from '../data/actions';
import { useData } from '../data/DataProvider';
import { BASE_CURRENCY } from '../domain/currency';
import { currencyLabel, formatAmount } from '../domain/money';
import type { Transaction } from '../domain/types';
import { useToast } from '../ui/Toast';
import { EntryForm } from './entry/EntryForm';

/** Быстрый ввод — полноэкранная модалка (SPEC 5.2). */
export function QuickEntry({ onClose }: { onClose: () => void }) {
  const { entry } = useNav();
  const { categoryById, accountById } = useData();
  const toast = useToast();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Форма закрывается только после записи в базу: если IndexedDB откажет, введённое не пропадёт.
  const saved = async (tx: Transaction) => {
    let result;
    try {
      result = await saveTransaction(tx, true);
    } catch (e) {
      toast({ message: `Не сохранилось: ${(e as Error).message}` });
      return;
    }
    onClose();
    const currency = accountById.get(tx.accountId)?.currency ?? BASE_CURRENCY;
    let message: string;
    if (tx.type === 'transfer') {
      const toCurrency = (tx.toAccountId && accountById.get(tx.toAccountId)?.currency) || currency;
      message = `Перевод ${formatAmount(tx.amount)} ${currencyLabel(currency)} → ${formatAmount(tx.toAmount ?? tx.amount)} ${currencyLabel(toCurrency)}`;
    } else {
      const title = tx.categoryId ? categoryById.get(tx.categoryId)?.name : 'Запись';
      const sign = tx.type === 'expense' ? '−' : '+';
      message = `${title} ${sign}${formatAmount(tx.amount)} ${currencyLabel(currency)}`;
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
      className="pt-safe pb-safe fixed inset-0 z-30 mx-auto flex max-w-lg flex-col bg-bg"
    >
      <div className="relative flex h-14 shrink-0 items-center justify-center px-2">
        <button type="button" onClick={onClose} className="absolute left-2 min-h-11 px-3 text-body font-medium text-accent">
          Отмена
        </button>
        <h2 id="quick-entry-title" className="text-h2 font-semibold">
          Новая запись
        </h2>
      </div>
      <EntryForm
        initialType={entry?.type ?? 'expense'}
        initialAccountId={entry?.accountId}
        initialDate={entry?.date}
        onSave={saved}
      />
    </div>
  );
}
