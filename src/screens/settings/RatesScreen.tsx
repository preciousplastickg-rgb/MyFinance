import { useState } from 'react';
import { useToday } from '../../app/nav';
import { updateSettings } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import { CURRENCIES, currencyInfo, isBase } from '../../domain/currency';
import { formatShortDate } from '../../domain/date';
import { formatRate, parseMoneyText } from '../../domain/money';
import { savedRate } from '../../domain/rate';
import type { Currency } from '../../domain/types';
import { ListGroup, Row } from '../../ui/controls';
import { SubScreen } from '../../ui/SubScreen';
import { ValueSheet } from '../../ui/ValueSheet';

/**
 * Курсы валют: последний курс каждой валюты, сом за 1 (SPEC 4.6).
 * Обновляются сами после обмена валюта ↔ сом; здесь — ручная правка.
 */
export function RatesScreen() {
  const { accounts, settings } = useData();
  const today = useToday();
  const [editing, setEditing] = useState<Currency | null>(null);
  const used = new Set(accounts.filter((a) => !a.archived && !isBase(a.currency)).map((a) => a.currency));
  for (const c of Object.keys(settings.rates ?? {})) used.add(c);
  const list = CURRENCIES.filter((c) => used.has(c.code));
  const others = CURRENCIES.filter((c) => !isBase(c.code) && !used.has(c.code));

  const row = (code: Currency) => {
    const r = savedRate(settings, code);
    const info = currencyInfo(code);
    return (
      <Row key={code} onClick={() => setEditing(code)}>
        <span className="w-12 shrink-0 font-semibold">{info.label}</span>
        <span className="min-w-0 flex-1 truncate text-muted">{info.name}</span>
        <span className="tabular text-right">
          {r ? (
            <>
              {formatRate(r.rate)} <span className="text-caption text-muted">· {formatShortDate(r.date)}</span>
            </>
          ) : (
            <span className="text-warn">задать</span>
          )}
        </span>
      </Row>
    );
  };

  return (
    <SubScreen title="Курсы валют" back="Настройки">
      <p className="px-1 text-caption text-muted">
        Сом за 1 единицу. Курс обновляется сам после обмена валюты на сомы и обратно; здесь можно поправить вручную.
      </p>
      {list.length > 0 && <ListGroup title="Валюты счетов">{list.map((c) => row(c.code))}</ListGroup>}
      <ListGroup title="Другие валюты">{others.map((c) => row(c.code))}</ListGroup>
      {editing && (
        <ValueSheet
          title={`Курс ${currencyInfo(editing).label}`}
          label={`Сом за 1 ${currencyInfo(editing).label}`}
          hint="Используется для «≈ сом», итога по счетам и отчётов."
          initial={savedRate(settings, editing) ? formatRate(savedRate(settings, editing)!.rate) : ''}
          parse={(t) => {
            const v = parseMoneyText(t);
            return v !== null && v > 0 ? v * 100 : null;
          }}
          onSave={(rate) => updateSettings({ rates: { ...(settings.rates ?? {}), [editing]: { rate, date: today } } })}
          onClose={() => setEditing(null)}
        />
      )}
    </SubScreen>
  );
}
