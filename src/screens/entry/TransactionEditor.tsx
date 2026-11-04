import { deleteTransaction, restoreTransaction, updateSettings, updateTransaction } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { rateUpdateAfter } from '../../domain/rate';
import type { Transaction } from '../../domain/types';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { EntryForm } from './EntryForm';

/** Правка операции в bottom sheet (SPEC 5.3). */
export function TransactionEditor({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const toast = useToast();
  const { settings } = useData();
  const remove = async () => {
    onClose();
    const deleted = await deleteTransaction(tx.id);
    if (deleted) toast({ message: 'Запись удалена', actionLabel: 'Отменить', onAction: () => void restoreTransaction(deleted) });
  };
  return (
    <Sheet title={tx.type === 'transfer' ? 'Перевод' : 'Запись'} onClose={onClose} full>
      <div className="-mx-5 flex h-full flex-col">
        <EntryForm
          initial={tx}
          onSave={(updated) => {
            void updateTransaction(updated);
            const rate = rateUpdateAfter(updated, settings);
            if (rate) void updateSettings(rate);
            onClose();
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
