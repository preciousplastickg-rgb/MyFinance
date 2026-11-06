import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { deleteTransaction, restoreTransaction, saveTransaction } from '../../data/actions';
import type { Transaction } from '../../domain/types';
import { useData } from '../../data/DataProvider';
import { DebtSheet } from '../debts/DebtSheet';
import { useToast } from '../../ui/Toast';
import { EntryForm } from './EntryForm';

/**
 * Правка операции (SPEC 5.3) — в той же полноэкранной модалке, что и «Новая запись».
 * В bottom sheet форма с клавиатурой не помещалась: вторая строка категорий и ряд «счёт · дата» уходили под клавиши.
 */
export function TransactionEditor({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const toast = useToast();
  const { debts } = useData();
  // Операция долга правится в карточке долга (этап 17).
  const debt = tx.type === 'debt' ? debts.find((d) => d.id === tx.debtId) : undefined;
  const isDebt = tx.type === 'debt';

  useEffect(() => {
    if (isDebt) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDebt]);

  const remove = async () => {
    onClose();
    const deleted = await deleteTransaction(tx.id);
    if (deleted) toast({ message: 'Запись удалена', actionLabel: 'Отменить', onAction: () => void restoreTransaction(deleted) });
  };
  if (isDebt) return debt ? <DebtSheet debt={debt} onClose={onClose} /> : null;
  const title = tx.type === 'transfer' ? 'Перевод' : 'Запись';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-editor-title"
      className="pt-safe pb-safe fixed inset-0 z-50 mx-auto flex max-w-lg flex-col bg-bg"
    >
      <div className="relative flex h-14 shrink-0 items-center justify-center px-2">
        <button type="button" onClick={onClose} className="absolute left-2 min-h-11 px-3 text-body font-medium text-accent">
          Отмена
        </button>
        <h2 id="tx-editor-title" className="text-h2 font-semibold">
          {title}
        </h2>
        {/* «Удалить» в шапке, а не под «Сохранить»: тогда форма ровно та же, что у новой записи, и ряд «счёт · дата» виден. */}
        <button type="button" onClick={() => void remove()} className="absolute right-2 min-h-11 px-3 text-body font-medium text-warn">
          Удалить запись
        </button>
      </div>
      <EntryForm
        initial={tx}
        onSave={async (updated, newDebt) => {
          try {
            await saveTransaction(updated, false, newDebt);
            onClose();
          } catch (e) {
            toast({ message: `Не сохранилось: ${(e as Error).message}` });
          }
        }}
      />
    </div>,
    document.body,
  );
}
