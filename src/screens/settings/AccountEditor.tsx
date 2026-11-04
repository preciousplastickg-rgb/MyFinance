import { useEffect, useState } from 'react';
import { accountHasTransactions, newId, nextSortOrder, saveAccount, setArchived } from '../../data/actions';
import { PALETTE } from '../../domain/catalog';
import { minorToText, parseMoneyText } from '../../domain/money';
import type { Account, Currency } from '../../domain/types';
import { ColorPicker } from '../../ui/ColorPicker';
import { Button, Field, Segmented, Switch, TextInput } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { IconPicker } from '../../ui/IconPicker';
import { Sheet } from '../../ui/Sheet';

const TYPE_ICON: Record<Account['type'], string> = { bank: 'Landmark', cash: 'Banknote', crypto: 'Coins' };

export function AccountEditor({ account, today, onClose }: { account?: Account; today: string; onClose: () => void }) {
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<Account['type']>(account?.type ?? 'bank');
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? 'KGS');
  const [opening, setOpening] = useState(account ? minorToText(account.openingBalance) : '0');
  const [openingDate, setOpeningDate] = useState(account?.openingDate ?? today);
  const [includeInDaily, setIncludeInDaily] = useState(account?.includeInDaily ?? true);
  const [color, setColor] = useState(account?.color ?? PALETTE[0]);
  const [icon, setIcon] = useState(account?.icon ?? 'Landmark');
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (account) void accountHasTransactions(account.id).then(setLocked);
  }, [account]);

  const openingMinor = parseMoneyText(opening);
  const valid = name.trim() !== '' && openingMinor !== null && /^\d{4}-\d{2}-\d{2}$/.test(openingDate);

  const save = async () => {
    if (!valid) return;
    await saveAccount({
      id: account?.id ?? newId(),
      name: name.trim(),
      type,
      currency,
      icon,
      color,
      includeInDaily,
      openingBalance: openingMinor,
      openingDate,
      sortOrder: account?.sortOrder ?? (await nextSortOrder('accounts')),
      archived: account?.archived ?? false,
    });
    onClose();
  };

  return (
    <Sheet
      title={account ? 'Счёт' : 'Новый счёт'}
      onClose={onClose}
      full
      footer={
        <Button className="w-full" disabled={!valid} onClick={() => void save()}>
          Сохранить
        </Button>
      }
    >
      <div className="space-y-5 pt-2">
        <div className="flex items-center gap-3">
          <IconCircle name={icon} color={color} size={56} dashed={currency === 'USDT'} />
          <div className="min-w-0 flex-1">
            <Field label="Название">{(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="MBank" />}</Field>
          </div>
        </div>
        <Segmented
          label="Тип счёта"
          value={type}
          onChange={(t) => {
            setType(t);
            setIcon(TYPE_ICON[t]);
            if (t === 'crypto') {
              setCurrency('USDT');
              setIncludeInDaily(false);
            }
          }}
          options={[
            { value: 'bank', label: 'Банк' },
            { value: 'cash', label: 'Наличные' },
            { value: 'crypto', label: 'Крипта' },
          ]}
        />
        <div className="space-y-1.5">
          <Segmented
            label="Валюта"
            value={currency}
            onChange={(c) => {
              if (locked) return;
              setCurrency(c);
              setIncludeInDaily(c === 'KGS');
            }}
            options={[
              { value: 'KGS', label: 'сом' },
              { value: 'USDT', label: 'USDT' },
            ]}
          />
          {locked && <p className="text-caption text-muted">Валюту нельзя сменить: по счёту уже есть операции.</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Начальный остаток, ${currency === 'KGS' ? 'сом' : 'USDT'}`}>
            {(id) => (
              <TextInput
                id={id}
                inputMode="decimal"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                className="tabular block min-h-12 w-full rounded-xl bg-bg px-3.5 text-body ring-1 ring-line outline-none focus:ring-2 focus:ring-accent"
              />
            )}
          </Field>
          <Field label="На дату">
            {(id) => <TextInput id={id} type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />}
          </Field>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-bg px-3.5 py-1">
          <div>
            <p>Учитывать в лимите на день</p>
            <p className="text-caption text-muted">Обычно сомовые счета — да, USDT — нет</p>
          </div>
          <Switch checked={includeInDaily} onChange={setIncludeInDaily} label="Учитывать в лимите на день" />
        </div>
        <Field label="Цвет">{() => <ColorPicker value={color} onChange={setColor} />}</Field>
        <Field label="Значок">{() => <IconPicker value={icon} color={color} onChange={setIcon} />}</Field>
        {account && (
          <Button
            variant="danger"
            className="w-full"
            onClick={() => void setArchived('accounts', account.id, !account.archived).then(onClose)}
          >
            {account.archived ? 'Вернуть из архива' : 'В архив'}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
