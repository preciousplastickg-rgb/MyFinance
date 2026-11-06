import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { formatShortDate } from '../../domain/date';
import { debtsOverview, type DebtState } from '../../domain/debts';
import { formatMoney } from '../../domain/money';
import type { Currency, Debt, Minor } from '../../domain/types';
import { Button, ListGroup, Row } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { SubScreen } from '../../ui/SubScreen';
import { DebtEditor } from './DebtEditor';
import { DebtSheet } from './DebtSheet';

const sums = (m: ReadonlyMap<Currency, Minor>) =>
  m.size ? [...m.entries()].map(([c, v]) => formatMoney(v, c)).join(' · ') : '0 сом';

/** «Долги»: мне должны / я должен, просроченные сверху, закрытые внизу (этап 17). */
export function DebtsScreen() {
  const { debts, transactions } = useData();
  const today = useToday();
  const o = debtsOverview(debts, transactions, today);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<Debt['direction'] | null>(null);
  const current = debts.find((d) => d.id === open);

  const row = (s: DebtState) => (
    <Row key={s.debt.id} onClick={() => setOpen(s.debt.id)} className={s.closed ? 'opacity-60' : ''}>
      <IconCircle name="HandCoins" color={s.debt.direction === 'owedToMe' ? '#0B7A4B' : '#B45309'} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{s.debt.person}</p>
        <p className={`truncate text-caption ${s.overdue ? 'font-semibold text-warn' : 'text-muted'}`}>
          {s.closed
            ? 'закрыт'
            : s.debt.dueDate
              ? `${s.overdue ? 'просрочен с' : 'до'} ${formatShortDate(s.debt.dueDate)}`
              : `с ${formatShortDate(s.debt.date)}`}
          {s.debt.note ? ` · ${s.debt.note}` : ''}
        </p>
      </div>
      <span className="tabular shrink-0 font-medium">{formatMoney(s.closed ? s.total : s.remaining, s.debt.currency)}</span>
      <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
    </Row>
  );

  return (
    <SubScreen title="Долги" back="Деньги">
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-card bg-line" aria-label="Итоги долгов">
        <div className="bg-surface p-4">
          <p className="text-caption text-muted">Мне должны</p>
          <p className="tabular font-semibold text-income">{sums(o.totals.owedToMe)}</p>
        </div>
        <div className="bg-surface p-4">
          <p className="text-caption text-muted">Я должен</p>
          <p className="tabular font-semibold">{sums(o.totals.iOwe)}</p>
        </div>
      </section>

      <div className="space-y-2">
        <ListGroup title="Мне должны">
          {o.owedToMe.length ? o.owedToMe.map(row) : <p className="px-4 py-3 text-caption text-muted">Никто не должен.</p>}
        </ListGroup>
        <Button variant="secondary" className="w-full" onClick={() => setAdding('owedToMe')}>
          Дал в долг
        </Button>
      </div>
      <div className="space-y-2">
        <ListGroup title="Я должен">
          {o.iOwe.length ? o.iOwe.map(row) : <p className="px-4 py-3 text-caption text-muted">Вы никому не должны.</p>}
        </ListGroup>
        <Button variant="secondary" className="w-full" onClick={() => setAdding('iOwe')}>
          Взял в долг
        </Button>
      </div>
      {o.closed.length > 0 && <ListGroup title="Закрытые">{o.closed.map(row)}</ListGroup>}

      {current && <DebtSheet debt={current} onClose={() => setOpen(null)} />}
      {adding && <DebtEditor initialDirection={adding} onClose={() => setAdding(null)} />}
    </SubScreen>
  );
}
