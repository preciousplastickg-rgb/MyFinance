import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef, useId } from 'react';

/** Переключатель 48×28: дорожка --primary, когда включён (HANDOFF, «Регулярные»). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 min-w-14 items-center justify-end disabled:opacity-40"
    >
      <span className={`flex h-7 w-12 rounded-[14px] p-[3px] ${checked ? 'justify-end bg-primary' : 'justify-start bg-line'}`}>
        <span className="size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)]" />
      </span>
    </button>
  );
}

/** Сегмент «Расход / Доход / Перевод», «Задачи / Привычки»: дорожка --sunk радиус 16, выбранный — белый с тенью. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-ctl bg-sunk p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`tap-44 min-h-9 rounded-[13px] px-2 text-sub font-semibold ${
            o.value === value ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Чип-пилюля: выбранный — --primary (счета в «Деньгах»), tone «ink» — чёрный с белым текстом (вкладки задач, сроки цели). */
export function Chip({
  selected,
  tone = 'primary',
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; tone?: 'primary' | 'soft' | 'ink' }) {
  const on = tone === 'soft' ? 'bg-accent/10 text-accent ring-1 ring-accent' : tone === 'ink' ? 'bg-ink text-bg' : 'bg-primary text-on-primary ring-1 ring-primary';
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`tap-44 inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-caption font-medium whitespace-nowrap ${
        selected ? on : tone === 'ink' ? 'text-muted' : 'bg-surface text-ink ring-1 ring-line'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const styles = {
    primary: 'bg-primary text-on-primary disabled:bg-sunk disabled:text-muted',
    secondary: 'bg-surface text-ink ring-[1.5px] ring-line ring-inset',
    danger: 'bg-surface text-warn ring-[1.5px] ring-line ring-inset',
    ghost: 'text-accent',
  }[variant];
  return (
    <button
      type="button"
      className={`min-h-12 rounded-ctl px-4 text-body font-semibold active:opacity-80 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-caption text-muted">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-caption text-muted">{hint}</p>}
    </div>
  );
}

/** Поле ввода: высота 44, подложка --sunk, скругление 16, в фокусе — рамка акцента. */
export const inputClass =
  'block min-h-11 w-full rounded-ctl bg-sunk px-3.5 text-input text-ink outline-none focus:ring-2 focus:ring-accent disabled:opacity-60';

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(props, ref) {
  return <input ref={ref} className={inputClass} {...props} />;
});

/** Группа строк в карточке: заголовок 13/600 --muted, строки разделены линией. */
export function ListGroup({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-2">
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 px-1">
          {title && <h2 className="text-caption font-semibold text-muted">{title}</h2>}
          {action}
        </div>
      )}
      <div className="card divide-y divide-line overflow-hidden">{children}</div>
    </section>
  );
}

export function Row({
  children,
  onClick,
  className = '',
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  label?: string;
}) {
  const cls = `flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} active:bg-sunk`} aria-label={label}>
      {children}
    </button>
  ) : (
    <div className={cls}>{children}</div>
  );
}
