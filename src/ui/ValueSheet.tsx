import { useState } from 'react';
import { Button, Field, TextInput } from './controls';
import { Sheet } from './Sheet';

/** Одно числовое поле в bottom sheet: курс, порог мелких трат. */
export function ValueSheet({
  title,
  label,
  hint,
  initial,
  parse,
  onSave,
  onClose,
}: {
  title: string;
  label: string;
  hint?: string;
  initial: string;
  parse: (text: string) => number | null;
  onSave: (value: number) => void | Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial);
  const value = parse(text);
  return (
    <Sheet title={title} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (value === null) return;
          void Promise.resolve(onSave(value)).then(onClose);
        }}
      >
        <Field label={label} hint={hint}>
          {(id) => <TextInput id={id} autoFocus inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} />}
        </Field>
        <Button type="submit" className="w-full" disabled={value === null}>
          Сохранить
        </Button>
      </form>
    </Sheet>
  );
}
