import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { BASE_CURRENCY } from '../../domain/currency';
import { currencyLabel, formatAmount, formatMoney } from '../../domain/money';
import { activeJars, isSavings, jarState, PURPOSES, savingsTotals } from '../../domain/savings';
import type { Account } from '../../domain/types';
import { Button, ListGroup, Row } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { SubScreen } from '../../ui/SubScreen';
import { JarEditor } from './JarEditor';
import { JarSheet } from './JarSheet';
import { colorCss } from '../../domain/catalog';

/** «Копилка»: все накопления по назначениям и валютам, итог ≈ в сомах (этап 20). */
export function SavingsScreen({ back = 'Деньги' }: { back?: string }) {
  const { accounts, balances, rateFor } = useData();
  const today = useToday();
  const jars = activeJars(accounts);
  const archived = accounts.filter((a) => a.archived && isSavings(a));
  const totals = savingsTotals(jars, balances, rateFor);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const current = accounts.find((a) => a.id === open);

  return (
    <SubScreen title="Копилка" back={back}>
      <section className="rounded-card bg-surface p-4" aria-label="Итог копилки">
        <p className="text-caption text-muted">Всего накоплено</p>
        <p className="tabular text-h1 font-bold">
          {totals.approx ? '≈ ' : ''}
          {formatMoney(totals.kgs, BASE_CURRENCY)}
        </p>
        {[...totals.byCurrency.keys()].some((c) => c !== BASE_CURRENCY) && (
          <p className="tabular text-caption text-muted">
            {[...totals.byCurrency.entries()].map(([c, v]) => formatMoney(v, c)).join(' · ')}
            {totals.missing.length > 0 && ` · без курса: ${totals.missing.map(currencyLabel).join(', ')}`}
          </p>
        )}
      </section>
      {jars.length ? (
        <ListGroup title="Копилки">{jars.map((j) => <JarRow key={j.id} jar={j} onOpen={() => setOpen(j.id)} />)}</ListGroup>
      ) : (
        <p className="rounded-card bg-surface p-4 text-center text-muted">
          Копилок пока нет. Заведите отдельную под каждую цель: депозит, наличные, фонд обучения, просто накопления.
        </p>
      )}
      <Button variant="secondary" className="w-full" onClick={() => setAdding(true)}>
        Новая копилка
      </Button>
      {archived.length > 0 && <ListGroup title="Архив">{archived.map((j) => <JarRow key={j.id} jar={j} onOpen={() => setOpen(j.id)} />)}</ListGroup>}
      {current && <JarSheet jar={current} onClose={() => setOpen(null)} />}
      {adding && <JarEditor onClose={() => setAdding(false)} />}
    </SubScreen>
  );

  function JarRow({ jar, onOpen }: { jar: Account; onOpen: () => void }) {
    const s = jarState(jar, balances.get(jar.id) ?? 0, today);
    return (
      <Row onClick={onOpen} className={jar.archived ? 'opacity-60' : ''}>
        <IconCircle name={jar.icon} color={jar.color} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-medium">{jar.name}</p>
          <p className="truncate text-caption text-muted">
            {PURPOSES[jar.purpose ?? 'savings'].label}
            {s.percent !== undefined ? ` · ${s.reached ? 'цель достигнута' : `${s.percent}% из ${formatAmount(jar.goal!)}`}` : ''}
          </p>
          {s.percent !== undefined && (
            <div className="h-1.5 overflow-hidden rounded-[2px] bg-line" aria-hidden>
              <div className="jar-fill h-full rounded-[2px]" style={{ width: `${s.percent}%`, background: colorCss(jar.color) }} />
            </div>
          )}
        </div>
        <span className="tabular shrink-0 font-semibold">{formatMoney(s.balance, jar.currency)}</span>
        <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
      </Row>
    );
  }
}
