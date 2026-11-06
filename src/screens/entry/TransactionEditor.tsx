import { useEffect } from 'react';
import { useSwipeDismiss } from '../../app/useSwipeDismiss';
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
  const swipe = useSwipeDismiss(onClose, { down: true });

  useEffect(() => {
    if (isDebt) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
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
      {...swipe.handlers}
      style={swipe.style}
      className="pt-safe pb-safe fixed inset-0 z-50 mx-auto flex max-w-lg touch-none flex-col bg-surface"
    >
      <div data-sheet-grab className="grid min-h-11 shrink-0 touch-none grid-cols-[1fr_auto_1fr] items-center px-4">
        <button type="button" onClick={onClose} className="min-h-11 justify-self-start pr-3 text-body font-medium text-accent">
          Отмена
        </button>
        <h2 id="tx-editor-title" className="text-h2 font-semibold">
          {title}
        </h2>
        {/* «Удалить» в шапке, а не под «Сохранить»: тогда форма ровно та же, что у новой записи, и ряд «счёт · дата» виден. */}
        <button type="button" onClick={() => void remove()} className="min-h-11 justify-self-end pl-3 text-body font-medium text-warn">
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
