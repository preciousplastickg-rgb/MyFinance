import { Placeholder } from '../ui/Placeholder';

export function QuickEntry({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-entry-title"
      className="pt-safe pb-safe fixed inset-0 z-20 flex flex-col bg-bg"
    >
      <div className="relative flex h-14 items-center justify-center px-2">
        <button
          type="button"
          onClick={onClose}
          className="absolute left-2 min-h-11 px-3 text-body font-medium text-accent"
        >
          Отмена
        </button>
        <h2 id="quick-entry-title" className="text-h2 font-semibold">
          Новая запись
        </h2>
      </div>
      <div className="px-5 pt-4">
        <Placeholder title="Быстрый ввод" text="Сумма, категория, «Сохранить» — этап 3." />
      </div>
    </div>
  );
}
