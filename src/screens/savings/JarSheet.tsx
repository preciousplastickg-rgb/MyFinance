import { useState } from 'react';
import { useNav, useToday } from '../../app/nav';
import { useData } from '../../data/DataProvider';
import { formatShortDate } from '../../domain/date';
import { formatMoney } from '../../domain/money';
import { everydayAccounts, jarState, PURPOSES } from '../../domain/savings';
import type { Account, Transaction } from '../../domain/types';
import { Button } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { TransactionEditor } from '../entry/TransactionEditor';
import { TxList } from '../reports/TxListSheet';
import { JarEditor } from './JarEditor';
import { colorCss } from '../../domain/catalog';

/** Копилка: остаток, прогресс к цели, «Пополнить» / «Снять» переводом, история (этап 20). */
export function JarSheet({ jar, onClose }: { jar: Account; onClose: () => void }) {
  const { accounts, balances, transactions } = useData();
  const { openEntry } = useNav();
  const today = useToday();
  const [editing, setEditing] = useState(false);
  const [tx, setTx] = useState<Transaction | null>(null);
  const s = jarState(jar, balances.get(jar.id) ?? 0, today);
  const everyday = everydayAccounts(accounts);
  const partner = everyday.find((a) => a.currency === jar.currency) ?? everyday[0];
  const history = transactions
    .filter((t) => t.accountId === jar.id || t.toAccountId === jar.id)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));

  if (editing) return <JarEditor jar={jar} onClose={() => setEditing(false)} />;

  const move = (into: boolean) => {
    onClose();
    // Перевод через обычную форму: разные валюты — курс посчитается сам.
    openEntry(into ? { type: 'transfer', accountId: partner?.id, toAccountId: jar.id } : { type: 'transfer', accountId: jar.id, toAccountId: partner?.id });
  };

  return (
    <Sheet title={jar.name} onClose={onClose} full>
      <div className="space-y-5">
        <div className="space-y-3 rounded-card bg-bg p-4">
          <div className="flex items-center gap-3">
            <IconCircle name={jar.icon} color={jar.color} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-caption text-muted">{PURPOSES[jar.purpose ?? 'savings'].label}</p>
              <p className="tabular text-h1 font-bold">{formatMoney(s.balance, jar.currency)}</p>
            </div>
          </div>
          {s.percent !== undefined && (
            <>
              <div
                className="h-2.5 overflow-hidden rounded-[2px] bg-line"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={s.percent}
                aria-label="Накоплено от цели"
              >
                <div className="jar-fill h-full rounded-[2px]" style={{ width: `${s.percent}%`, background: colorCss(jar.color) }} />
              </div>
              <p className="tabular text-caption text-muted">
                {s.reached
                  ? `Цель ${formatMoney(jar.goal!, jar.currency)} достигнута`
                  : `${s.percent}% из ${formatMoney(jar.goal!, jar.currency)} · осталось ${formatMoney(s.left!, jar.currency)}`}
                {s.perMonth !== undefined && jar.goalDate && ` · по ${formatMoney(s.perMonth, jar.currency)} в месяц до ${formatShortDate(jar.goalDate)}`}
              </p>
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => move(true)}>Пополнить</Button>
          <Button variant="secondary" onClick={() => move(false)}>
            Снять
          </Button>
        </div>
        <section className="space-y-2">
          <h3 className="text-caption font-semibold text-muted">История</h3>
          {history.length ? <TxList list={history} today={today} onOpen={setTx} /> : <p className="rounded-card bg-bg px-4 py-3 text-caption text-muted">Пополнений пока не было.</p>}
        </section>
        <Button variant="secondary" className="w-full" onClick={() => setEditing(true)}>
          Изменить копилку
        </Button>
      </div>
      {tx && <TransactionEditor tx={tx} onClose={() => setTx(null)} />}
    </Sheet>
  );
}
