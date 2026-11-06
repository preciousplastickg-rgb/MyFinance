import { useState } from 'react';
import { useToday } from '../../app/nav';
import { formatDayTitle } from '../../domain/date';
import type { Transaction } from '../../domain/types';
import { Sheet } from '../../ui/Sheet';
import { TransactionRow } from '../../ui/TransactionRow';
import { TransactionEditor } from '../entry/TransactionEditor';

/** Операции за пунктом отчёта: по дням, новые сверху; тап — правка (этап 18). */
export function TxListSheet({ title, subtitle, transactions, onClose }: { title: string; subtitle?: string; transactions: readonly Transaction[]; onClose: () => void }) {
  const today = useToday();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const list = [...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  return (
    <Sheet title={title} onClose={onClose} full>
      <div className="space-y-3">
        {subtitle && <p className="text-caption text-muted">{subtitle}</p>}
        {list.length === 0 ? (
          <p className="py-6 text-center text-muted">Операций нет</p>
        ) : (
          <TxList list={list} today={today} onOpen={setEditing} />
        )}
      </div>
      {editing && <TransactionEditor tx={editing} onClose={() => setEditing(null)} />}
    </Sheet>
  );
}

/** Список операций с заголовками дней; тап по строке — onOpen. */
export function TxList({ list, today, onOpen }: { list: readonly Transaction[]; today: string; onOpen: (t: Transaction) => void }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-card ring-1 ring-line">
      {list.map((t, i) => (
        <div key={t.id}>
          {(i === 0 || list[i - 1]!.date !== t.date) && (
            <p className="bg-bg px-4 pt-2 pb-1 text-caption font-semibold text-muted">{formatDayTitle(t.date, today)}</p>
          )}
          <TransactionRow tx={t} onClick={() => onOpen(t)} />
        </div>
      ))}
    </div>
  );
}
