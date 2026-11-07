import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNav } from '../app/nav';
import { updateSettings } from '../data/actions';
import { useData } from '../data/DataProvider';
import { formatShortDate, toLocalDate } from '../domain/date';
import { formatMoney, minorToText, parseMoneyText } from '../domain/money';
import { ValueSheet } from '../ui/ValueSheet';
import { useBackupSaver } from '../app/useBackupSaver';
import { saveCsv } from '../data/backup';
import { parseBackup, type Backup } from '../domain/backup';
import { useToast } from '../ui/Toast';
import { AppearanceSheet, appearanceSummary } from './settings/AppearanceSheet';
import { DeleteAllSheet, ImportSheet } from './settings/DataSheets';
import { SCHEMA_VERSION } from '../db';
import { requestPersistentStorage, type StorageState } from '../db/persist';
import { ListGroup, Row } from '../ui/controls';
import { Icon } from '../ui/icons';
import { SubScreen } from '../ui/SubScreen';
import { BASE_CURRENCY } from '../domain/currency';

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
  const { accounts, categories, areas, settings } = useData();
  const [storage, setStorage] = useState<StorageState | null>(null);
  const [sheet, setSheet] = useState<'threshold' | 'delete' | 'appearance' | null>(null);
  const [incoming, setIncoming] = useState<{ backup: Backup; summary: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const backup = useBackupSaver();

  const backupNow = async () => {
    try {
      if (await backup.save()) toast({ message: 'Бэкап сохранён' });
    } catch (e) {
      toast({ message: `Не получилось: ${(e as Error).message}` });
    }
  };
  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    const result = await parseBackup(await file.text());
    if (result.ok) setIncoming({ backup: result.backup, summary: result.summary });
    else toast({ message: result.error });
  };
  const standalone = window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => {
    void requestPersistentStorage().then(setStorage);
  }, []);

  return (
    <SubScreen title="Настройки" back="Сегодня">
      <ListGroup>
        <NavRow icon="Landmark" label="Счета" value={String(accounts.filter((a) => !a.archived).length)} onClick={() => push({ name: 'accounts' })} />
        <NavRow icon="Palette" label="Категории" value={String(categories.filter((c) => !c.archived).length)} onClick={() => push({ name: 'categories' })} />
        <NavRow icon="Target" label="Сферы дел" value={String(areas.filter((a) => !a.archived).length)} onClick={() => push({ name: 'areas' })} />
      </ListGroup>
      <ListGroup title="Деньги">
        <NavRow
          icon="ArrowLeftRight"
          label="Курсы валют"
          value={(() => {
            const n = Object.keys(settings.rates ?? {}).length || (settings.lastUsdtRate ? 1 : 0);
            return n ? `${n}` : 'не заданы';
          })()}
          onClick={() => push({ name: 'rates' })}
        />
        <NavRow icon="Coins" label="Порог мелких трат" value={formatMoney(settings.smallExpenseThreshold, BASE_CURRENCY)} onClick={() => setSheet('threshold')} />
      </ListGroup>
      <ListGroup title="Вид">
        <NavRow icon="Palette" label="Оформление" value={appearanceSummary(settings)} onClick={() => setSheet('appearance')} />
      </ListGroup>
      <ListGroup title="Данные">
        <NavRow
          icon="Shield"
          label="Сохранить бэкап"
          value={settings.lastBackupAt ? formatShortDate(toLocalDate(settings.lastBackupAt)) : 'не было'}
          onClick={() => void backupNow()}
        />
        <NavRow icon="Package" label="Восстановить из бэкапа" onClick={() => fileInput.current?.click()} />
        <NavRow icon="Receipt" label="Экспорт операций в CSV" onClick={() => void saveCsv()} />
        <Row onClick={() => setSheet('delete')}>
          <Icon name="Flame" size={22} className="text-warn" />
          <span className="flex-1 text-warn">Удалить все данные</span>
        </Row>
      </ListGroup>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        aria-label="Файл бэкапа"
        className="hidden"
        onChange={(e) => {
          void pickFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <ListGroup title="О приложении">
        <InfoRow label="Версия" value={__APP_VERSION__} />
        <InfoRow label="Схема данных" value={`v${SCHEMA_VERSION}`} />
        <InfoRow label="Хранилище" value={storage ? STORAGE_TEXT[storage] : '…'} />
        <InfoRow label="Запуск" value={standalone ? 'с экрана «Домой»' : 'в браузере'} />
      </ListGroup>
      {backup.sheet}
      {incoming && <ImportSheet backup={incoming.backup} summary={incoming.summary} onClose={() => setIncoming(null)} />}
      {sheet === 'delete' && <DeleteAllSheet onClose={() => setSheet(null)} />}
      {sheet === 'appearance' && <AppearanceSheet onClose={() => setSheet(null)} />}
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
