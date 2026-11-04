import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNav, useToday } from '../app/nav';
import { updateSettings } from '../data/actions';
import { useData } from '../data/DataProvider';
import { formatShortDate } from '../domain/date';
import { formatMoney, formatRate, minorToText, parseMoneyText } from '../domain/money';
import { ValueSheet } from '../ui/ValueSheet';
import { SCHEMA_VERSION } from '../db';
import { requestPersistentStorage, type StorageState } from '../db/persist';
import { ListGroup, Row } from '../ui/controls';
import { Icon } from '../ui/icons';
import { SubScreen } from '../ui/SubScreen';

const STORAGE_TEXT: Record<StorageState, string> = {
  persisted: 'постоянное',
  'best-effort': 'может быть очищено системой',
  unsupported: 'нет данных',
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Row>
      <span className="flex-1">{label}</span>
      <span className="text-right text-muted">{value}</span>
    </Row>
  );
}

function NavRow({ icon, label, value, onClick }: { icon: string; label: string; value?: string; onClick: () => void }) {
  return (
    <Row onClick={onClick}>
      <Icon name={icon} size={22} className="text-accent" />
      <span className="flex-1">{label}</span>
      {value && <span className="text-muted">{value}</span>}
      <ChevronRight size={18} className="text-muted" aria-hidden />
    </Row>
  );
}

export function Settings() {
  const { push } = useNav();
  const { accounts, categories, settings } = useData();
  const today = useToday();
  const [storage, setStorage] = useState<StorageState | null>(null);
  const [sheet, setSheet] = useState<'rate' | 'threshold' | null>(null);
  const standalone = window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => {
    void requestPersistentStorage().then(setStorage);
  }, []);

  return (
    <SubScreen title="Настройки" back="Сегодня">
      <ListGroup>
        <NavRow icon="Landmark" label="Счета" value={String(accounts.filter((a) => !a.archived).length)} onClick={() => push({ name: 'accounts' })} />
        <NavRow icon="Palette" label="Категории" value={String(categories.filter((c) => !c.archived).length)} onClick={() => push({ name: 'categories' })} />
      </ListGroup>
      <ListGroup title="Деньги">
        <NavRow
          icon="Coins"
          label="Курс USDT"
          value={settings.lastUsdtRate ? `${formatRate(settings.lastUsdtRate)} · ${formatShortDate(settings.lastUsdtRateDate ?? today)}` : 'не задан'}
          onClick={() => setSheet('rate')}
        />
        <NavRow icon="Receipt" label="Порог мелких трат" value={formatMoney(settings.smallExpenseThreshold, 'KGS')} onClick={() => setSheet('threshold')} />
      </ListGroup>
      <ListGroup title="О приложении">
        <InfoRow label="Версия" value={__APP_VERSION__} />
        <InfoRow label="Схема данных" value={`v${SCHEMA_VERSION}`} />
        <InfoRow label="Хранилище" value={storage ? STORAGE_TEXT[storage] : '…'} />
        <InfoRow label="Запуск" value={standalone ? 'с экрана «Домой»' : 'в браузере'} />
      </ListGroup>
      {sheet === 'rate' && (
        <ValueSheet
          title="Курс USDT"
          label="Сом за 1 USDT"
          hint="Обычно обновляется сам после перевода USDT ↔ сом. Используется для «≈ сом» и итога по счетам."
          initial={settings.lastUsdtRate ? formatRate(settings.lastUsdtRate) : ''}
          parse={(t) => {
            const v = parseMoneyText(t);
            return v !== null && v > 0 ? v * 100 : null;
          }}
          onSave={(rate) => updateSettings({ lastUsdtRate: rate, lastUsdtRateDate: today })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'threshold' && (
        <ValueSheet
          title="Порог мелких трат"
          label="Сом"
          hint="Траты меньше порога попадают в карточку «Мелкие траты» в отчётах."
          initial={minorToText(settings.smallExpenseThreshold)}
          parse={(t) => {
            const v = parseMoneyText(t);
            return v !== null && v > 0 ? v : null;
          }}
          onSave={(v) => updateSettings({ smallExpenseThreshold: v })}
          onClose={() => setSheet(null)}
        />
      )}
    </SubScreen>
  );
}
