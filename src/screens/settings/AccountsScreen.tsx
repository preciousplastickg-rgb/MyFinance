import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { reorder } from '../../data/actions';
import { formatMoney } from '../../domain/money';
import type { Account } from '../../domain/types';
import { Button, ListGroup, Row } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { SortableList } from '../../ui/SortableList';
import { SubScreen } from '../../ui/SubScreen';
import { AccountEditor } from './AccountEditor';

const TYPE_LABEL: Record<Account['type'], string> = { bank: 'Банк', cash: 'Наличные', crypto: 'Крипта' };

export function AccountsScreen() {
  const { accounts, balances } = useData();
  const today = useToday();
  const [editing, setEditing] = useState<Account | 'new' | null>(null);
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  const row = (a: Account) => (
    <Row onClick={() => setEditing(a)} className="pr-1">
      <IconCircle name={a.icon} color={a.color} dashed={a.currency !== 'KGS'} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{a.name}</p>
        <p className="text-caption text-muted">
          {TYPE_LABEL[a.type]}
          {a.includeInDaily ? ' · в лимите' : ''}
        </p>
      </div>
      <span className={`tabular shrink-0 ${(balances.get(a.id) ?? 0) < 0 ? 'text-warn' : ''}`}>
        {formatMoney(balances.get(a.id) ?? 0, a.currency)}
      </span>
    </Row>
  );

  return (
    <SubScreen
      title="Счета"
      back="Настройки"
      action={
        <button
          type="button"
          aria-label="Новый счёт"
          onClick={() => setEditing('new')}
          className="flex size-11 items-center justify-center rounded-full text-accent active:bg-line"
        >
          <Plus size={24} aria-hidden />
        </button>
      }
    >
      {active.length ? (
        <section className="space-y-2">
          <p className="px-1 text-caption text-muted">Порядок меняется перетаскиванием за ручку справа</p>
          <SortableList
            items={active}
            itemLabel={(a) => a.name}
            onReorder={(ids) => void reorder('accounts', [...ids, ...archived.map((a) => a.id)])}
            renderItem={row}
          />
        </section>
      ) : (
        <Button className="w-full" onClick={() => setEditing('new')}>
          Добавить счёт
        </Button>
      )}
      {archived.length > 0 && <ListGroup title="Архив">{archived.map((a) => <div key={a.id}>{row(a)}</div>)}</ListGroup>}
      {editing && (
        <AccountEditor account={editing === 'new' ? undefined : editing} today={today} onClose={() => setEditing(null)} />
      )}
    </SubScreen>
  );
}
