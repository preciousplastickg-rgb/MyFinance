import { useState } from 'react';
import { newId } from '../../data/actions';
import { currencyLabel, minorToText, parseMoneyText } from '../../domain/money';
import type { Account, Category, Recurring, RecurringSchedule } from '../../domain/types';
import { Button, Field, inputClass, Segmented, Switch, TextInput } from '../../ui/controls';
import { ConfirmSheet } from '../../ui/ConfirmSheet';
import { Sheet } from '../../ui/Sheet';

const WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export type RecurringDraft = Partial<Recurring> & Pick<Recurring, 'kind'>;

/** Регулярный платёж или источник дохода. Счета передаются явно: на первом запуске они ещё не сохранены. */
export function RecurringEditor({
  initial,
  accounts,
  categories,
  today,
  onSave,
  onDelete,
  onClose,
}: {
  initial: RecurringDraft;
  accounts: readonly Account[];
  categories: readonly Category[];
  today: string;
  onSave: (recurring: Recurring) => void | Promise<void>;
  /** Есть — в редакторе кнопка «Удалить» с подтверждением. */
  onDelete?: () => void;
  onClose: () => void;
}) {
  const kind = initial.kind;
  const activeAccounts = accounts.filter((a) => !a.archived);
  const kindCategories = categories.filter((c) => c.kind === kind && !c.archived);
  const defaultCategory =
    kindCategories.find((c) => c.name === (kind === 'income' ? 'Зарплата' : 'Жильё')) ?? kindCategories[0];

  const [name, setName] = useState(initial.name ?? '');
  const [amount, setAmount] = useState(initial.amount ? minorToText(initial.amount) : '');
  const [accountId, setAccountId] = useState(initial.accountId ?? activeAccounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? defaultCategory?.id ?? '');
  const [schedule, setSchedule] = useState<RecurringSchedule>(initial.schedule ?? { type: 'monthly', day: 10 });
  const [isMandatory, setIsMandatory] = useState(initial.isMandatory ?? kind === 'expense');
  const [isSubscription, setIsSubscription] = useState(initial.isSubscription ?? false);
  const [startDate, setStartDate] = useState(initial.startDate ?? today);
  const [active, setActive] = useState(initial.active ?? true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const account = activeAccounts.find((a) => a.id === accountId) ?? accounts.find((a) => a.id === accountId);
  // Отметки «оплачено» привязаны к датам старого расписания: после смены дня прошлые наступления сдвинутся.
  const scheduleChanged = !!initial.id && JSON.stringify(schedule) !== JSON.stringify(initial.schedule);
  const amountMinor = parseMoneyText(amount);
  const valid = name.trim() !== '' && amountMinor !== null && amountMinor > 0 && !!account && categoryId !== '';

  const save = async () => {
    if (!valid || !account || amountMinor === null) return;
    await onSave({
      id: initial.id ?? newId(),
      kind,
      name: name.trim(),
      amount: amountMinor,
      currency: account.currency,
      accountId: account.id,
      categoryId,
      schedule,
      isMandatory: kind === 'expense' && isMandatory,
      isSubscription: kind === 'expense' && isSubscription,
      startDate,
      active,
    });
    onClose();
  };

  const select = `${inputClass} appearance-none`;
  const setType = (type: RecurringSchedule['type']) => {
    if (type === 'monthly') setSchedule({ type, day: 'day' in schedule ? schedule.day : 10 });
    if (type === 'weekly') setSchedule({ type, weekday: 1 });
    if (type === 'yearly') setSchedule({ type, month: 1, day: 'day' in schedule ? schedule.day : 1 });
  };

  return (
    <Sheet
      title={initial.id ? (kind === 'income' ? 'Источник дохода' : 'Регулярный платёж') : kind === 'income' ? 'Новый источник дохода' : 'Новый платёж'}
      onClose={onClose}
      full
      footer={
        <Button className="w-full" disabled={!valid} onClick={() => void save()}>
          Сохранить
        </Button>
      }
    >
      <div className="space-y-5 pt-2">
        <Field label="Название">
          {(id) => (
            <TextInput
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === 'income' ? 'Зарплата' : 'Аренда квартиры'}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Сумма, ${account ? currencyLabel(account.currency) : 'сом'}`}>
            {(id) => (
              <TextInput id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            )}
          </Field>
          <Field label="Счёт">
            {(id) => (
              <select id={id} className={select} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Field label="Категория">
          {(id) => (
            <select id={id} className={select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {kindCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="space-y-3">
          <Segmented
            label="Периодичность"
            value={schedule.type}
            onChange={setType}
            options={[
              { value: 'monthly', label: 'Каждый месяц' },
              { value: 'weekly', label: 'Неделя' },
              { value: 'yearly', label: 'Год' },
            ]}
          />
          {schedule.type === 'monthly' && (
            <Field label="Число месяца" hint="29–31 в коротком месяце — последний день месяца">
              {(id) => (
                <select id={id} className={select} value={schedule.day} onChange={(e) => setSchedule({ type: 'monthly', day: Number(e.target.value) })}>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          {schedule.type === 'weekly' && (
            <Field label="День недели">
              {(id) => (
                <select id={id} className={select} value={schedule.weekday} onChange={(e) => setSchedule({ type: 'weekly', weekday: Number(e.target.value) })}>
                  {WEEKDAYS.map((w, i) => (
                    <option key={w} value={i + 1}>
                      {w}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          {scheduleChanged && (
            <p className="text-caption text-warn">
              Отметки «оплачено» привязаны к старым датам: наступления за прошлый месяц могут показаться просроченными. Их можно отметить
              в «Сегодня → …» или в итоге дня.
            </p>
          )}
          {schedule.type === 'yearly' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Месяц">
                {(id) => (
                  <select id={id} className={select} value={schedule.month} onChange={(e) => setSchedule({ ...schedule, month: Number(e.target.value) })}>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Число">
                {(id) => (
                  <select id={id} className={select} value={schedule.day} onChange={(e) => setSchedule({ ...schedule, day: Number(e.target.value) })}>
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          )}
        </div>
        {kind === 'expense' && (
          <div className="divide-y divide-line rounded-[20px] bg-sunk px-3.5">
            <div className="flex min-h-14 items-center justify-between gap-3">
              <div>
                <p className="font-medium">Обязательный</p>
                <p className="text-[12px] text-muted">Резервируется в лимите на день</p>
              </div>
              <Switch checked={isMandatory} onChange={setIsMandatory} label="Обязательный" />
            </div>
            <div className="flex min-h-14 items-center justify-between gap-3">
              <div>
                <p className="font-medium">Подписка</p>
                <p className="text-[12px] text-muted">Попадает в «Где можно сократить»</p>
              </div>
              <Switch checked={isSubscription} onChange={setIsSubscription} label="Подписка" />
            </div>
          </div>
        )}
        <Field label="Начиная с">
          {(id) => <TextInput id={id} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}
        </Field>
        {initial.id && (
          <div className="flex min-h-14 items-center justify-between gap-3 rounded-[20px] bg-sunk px-3.5">
            <p className="font-medium">Активен</p>
            <Switch checked={active} onChange={setActive} label="Активен" />
          </div>
        )}
        {initial.id && onDelete && (
          <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>
            Удалить
          </Button>
        )}
      </div>
      {confirmDelete && onDelete && (
        <ConfirmSheet
          title={`Удалить «${initial.name ?? ''}»?`}
          text="Он пропадёт из списка, лимита и «Сегодня». Прошлые операции останутся в истории."
          confirmLabel="Удалить"
          onConfirm={() => {
            onDelete();
            onClose();
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </Sheet>
  );
}
