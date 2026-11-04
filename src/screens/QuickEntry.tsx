import { useEffect } from 'react';
import { useNav } from '../app/nav';
import { addTransaction, deleteTransaction } from '../data/actions';
import { useData } from '../data/DataProvider';
import { formatAmount, currencyLabel } from '../domain/money';
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

  const saved = (tx: Transaction) => {
    void addTransaction(tx);
    onClose();
    const currency = accountById.get(tx.accountId)?.currency ?? 'KGS';
    const title = tx.categoryId ? categoryById.get(tx.categoryId)?.name : 'Запись';
    const sign = tx.type === 'expense' ? '−' : '+';
    toast({
      message: `${title} ${sign}${formatAmount(tx.amount)} ${currencyLabel(currency)}`,
      actionLabel: 'Отменить',
      onAction: () => void deleteTransaction(tx.id),
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
        initialType={entry?.type === 'income' ? 'income' : 'expense'}
        initialAccountId={entry?.accountId}
        onSave={saved}
      />
    </div>
  );
}
