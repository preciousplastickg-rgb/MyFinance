import { useState } from 'react';
import { useToday } from '../../app/nav';
import { newId, nextSortOrder, saveAccount, setArchived } from '../../data/actions';
import { BASE_CURRENCY, CURRENCIES } from '../../domain/currency';
import { currencyLabel, minorToText, parseMoneyText } from '../../domain/money';
import { PURPOSES } from '../../domain/savings';
import type { Account, Currency, SavingsPurpose } from '../../domain/types';
import { ColorPicker } from '../../ui/ColorPicker';
import { Button, Field, inputClass, TextInput } from '../../ui/controls';
import { IconCircle } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';

const PURPOSE_KEYS = Object.keys(PURPOSES) as SavingsPurpose[];

/** Копилка (этап 20): название, назначение, валюта, сколько уже есть, цель и срок. */
export function JarEditor({ jar, onClose }: { jar?: Account; onClose: () => void }) {
  const today = useToday();
  const [name, setName] = useState(jar?.name ?? '');
  const [purpose, setPurpose] = useState<SavingsPurpose>(jar?.purpose ?? 'savings');
  const [currency, setCurrency] = useState<Currency>(jar?.currency ?? BASE_CURRENCY);
  const [opening, setOpening] = useState(jar ? minorToText(jar.openingBalance) : '');
  const [goal, setGoal] = useState(jar?.goal ? minorToText(jar.goal) : '');
  const [goalDate, setGoalDate] = useState(jar?.goalDate ?? '');
  const [color, setColor] = useState(jar?.color ?? PURPOSES.savings.color);
  const [colorTouched, setColorTouched] = useState(!!jar);

  const openingMinor = opening.trim() === '' ? 0 : parseMoneyText(opening);
  const goalMinor = goal.trim() === '' ? undefined : parseMoneyText(goal);
  const valid = name.trim() !== '' && openingMinor !== null && openingMinor >= 0 && goalMinor !== null && (goalMinor === undefined || goalMinor > 0);

  const save = async () => {
    if (!valid) return;
    const next: Account = {
      ...jar,
      id: jar?.id ?? newId(),
      name: name.trim(),
      type: 'savings',
      currency,
      icon: PURPOSES[purpose].icon,
      color,
      includeInDaily: false,
      openingBalance: openingMinor!,
      openingDate: jar?.openingDate ?? today,
      sortOrder: jar?.sortOrder ?? (await nextSortOrder('accounts')),
      archived: jar?.archived ?? false,
      purpose,
    };
    if (goalMinor) next.goal = goalMinor;
    else delete next.goal;
    if (goalMinor && goalDate) next.goalDate = goalDate;
    else delete next.goalDate;
    await saveAccount(next);
    onClose();
  };

  return (
    <Sheet
      title={jar ? 'Копилка' : 'Новая копилка'}
      onClose={onClose}
      full
      footer={
        <Button className="w-full" disabled={!valid} onClick={() => void save()}>
          Сохранить
        </Button>
      }
    >
      <div className="space-y-5 pt-1">
        <div className="flex items-center gap-3">
          <IconCircle name={PURPOSES[purpose].icon} color={color} size={56} />
          <div className="min-w-0 flex-1">
            <Field label="Название">
              {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Фонд обучения" />}
            </Field>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-caption text-muted">Назначение</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Назначение">
            {PURPOSE_KEYS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={purpose === p}
                onClick={() => {
                  setPurpose(p);
                  if (!colorTouched) setColor(PURPOSES[p].color);
                }}
                className={`flex min-h-12 items-center gap-2 rounded-ctl px-3 text-left font-medium ${purpose === p ? 'bg-primary text-white' : 'bg-bg ring-1 ring-line'}`}
              >
                <IconCircle name={PURPOSES[p].icon} color={purpose === p ? '#ffffff' : PURPOSES[p].color} size={26} />
                {PURPOSES[p].label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Валюта">
            {(id) => (
              <select id={id} disabled={!!jar} className={`${inputClass} appearance-none`} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={`Уже есть, ${currencyLabel(currency)}`}>
            {(id) => <TextInput id={id} inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" />}
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Цель, ${currencyLabel(currency)}`} hint="Необязательно">
            {(id) => <TextInput id={id} inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="—" />}
          </Field>
          <Field label="Накопить к">
            {(id) => <TextInput id={id} type="date" value={goalDate} disabled={!goalMinor} onChange={(e) => setGoalDate(e.target.value)} />}
          </Field>
        </div>
        <Field label="Цвет">
          {() => (
            <ColorPicker
              value={color}
              onChange={(c) => {
                setColor(c);
                setColorTouched(true);
              }}
            />
          )}
        </Field>
        {jar && (
          <Button variant="danger" className="w-full" onClick={() => void setArchived('accounts', jar.id, !jar.archived).then(onClose)}>
            {jar.archived ? 'Вернуть из архива' : 'В архив'}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
