import { deleteTransaction, restoreTransaction, saveTransaction } from '../../data/actions';
import type { Transaction } from '../../domain/types';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { EntryForm } from './EntryForm';

/** Правка операции в bottom sheet (SPEC 5.3). */
export function TransactionEditor({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const toast = useToast();
  const remove = async () => {
    onClose();
    const deleted = await deleteTransaction(tx.id);
    if (deleted) toast({ message: 'Запись удалена', actionLabel: 'Отменить', onAction: () => void restoreTransaction(deleted) });
  };
  return (
    <Sheet title={tx.type === 'transfer' ? 'Перевод' : 'Запись'} onClose={onClose} full>
      <div className="-mx-4 flex h-full flex-col">
        <EntryForm
          initial={tx}
          onSave={async (updated) => {
            try {
              await saveTransaction(updated, false);
              onClose();
            } catch (e) {
              toast({ message: `Не сохранилось: ${(e as Error).message}` });
            }
          }}
          footerExtra={
            <button type="button" onClick={() => void remove()} className="min-h-11 w-full font-medium text-warn">
              Удалить запись
            </button>
          }
        />
      </div>
    </Sheet>
  );
}
