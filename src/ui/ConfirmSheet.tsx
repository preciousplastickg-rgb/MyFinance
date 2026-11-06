import { Button } from './controls';
import { Sheet } from './Sheet';

/** Своё подтверждение вместо window.confirm: вопрос, пояснение, опасное действие и «Отмена». */
export function ConfirmSheet({
  title,
  text,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  text?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="space-y-3">
        {text && <p className="text-muted">{text}</p>}
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
        <Button variant="secondary" className="w-full" onClick={onClose}>
          Отмена
        </Button>
      </div>
    </Sheet>
  );
}
