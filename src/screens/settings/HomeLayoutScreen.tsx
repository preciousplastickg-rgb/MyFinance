import { useEffect, useState } from 'react';
import { updateSettings } from '../../data/actions';
import { useData } from '../../data/DataProvider';
import {
  HOME_BLOCK_HINTS,
  HOME_BLOCK_NAMES,
  homeLayoutOf,
  reorderHome,
  setHomeVisible,
  toHomeLayout,
  type HomeBlock,
} from '../../domain/homeLayout';
import { Switch } from '../../ui/controls';
import { SortableList } from '../../ui/SortableList';
import { SubScreen } from '../../ui/SubScreen';
import { useToast } from '../../ui/Toast';

/**
 * «Главный экран» (по просьбе пользователя, 2026-11-09, SPEC 5.1a): порядок разделов «Сегодня» — перетаскиванием за ручку,
 * выключатель убирает раздел с главной (данные остаются в своих вкладках). Открывается кнопкой внизу «Сегодня»
 * и из «Настройки → Вид».
 */
export function HomeLayoutScreen({ back = 'Сегодня' }: { back?: string }) {
  const { settings } = useData();
  const toast = useToast();
  // Новый порядок виден сразу, не дожидаясь ответа базы, — иначе строки на миг прыгают на старые места.
  const [pending, setPending] = useState<HomeBlock[] | null>(null);
  useEffect(() => setPending(null), [settings.homeLayout]);
  const blocks = pending ?? homeLayoutOf(settings);
  const isDefault = !toHomeLayout(blocks);

  const save = (next: HomeBlock[]) => {
    setPending(next);
    void updateSettings({ homeLayout: toHomeLayout(next) });
  };
  const reset = () => {
    const before = settings.homeLayout;
    save(homeLayoutOf({}));
    toast({ message: 'Главная — как было', actionLabel: 'Отменить', onAction: () => void updateSettings({ homeLayout: before }) });
  };

  return (
    <SubScreen title="Главный экран" back={back}>
      <section className="space-y-2">
        <p className="px-1 text-caption text-muted">
          Порядок разделов на «Сегодня» — перетащите за ручку справа. Выключенный раздел не показывается на главной, его данные остаются в своих вкладках.
        </p>
        <SortableList
          items={blocks}
          itemLabel={(b) => HOME_BLOCK_NAMES[b.id]}
          onReorder={(ids) => save(reorderHome(blocks, ids))}
          renderItem={(b) => (
            <div className="flex min-h-14 items-center gap-1 py-1.5 pl-2" data-home-block={b.id}>
              <Switch checked={b.visible} onChange={(on) => save(setHomeVisible(blocks, b.id, on))} label={`Показывать «${HOME_BLOCK_NAMES[b.id]}»`} />
              <div className="min-w-0 flex-1 pl-2">
                <p className={`truncate font-medium ${b.visible ? '' : 'text-muted'}`}>{HOME_BLOCK_NAMES[b.id]}</p>
                <p className="truncate text-caption text-muted">{b.visible ? HOME_BLOCK_HINTS[b.id] : 'Не показывается'}</p>
              </div>
            </div>
          )}
        />
      </section>
      {!isDefault && (
        <button type="button" onClick={reset} className="flex min-h-11 w-full items-center justify-center text-body font-medium text-accent">
          Вернуть как было
        </button>
      )}
    </SubScreen>
  );
}
