import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

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
      <span
        className={`relative h-[31px] w-[51px] rounded-ctl transition-colors duration-150 ${checked ? 'bg-income' : 'bg-line'}`}
      >
        <span
          className={`absolute top-[2px] left-[2px] size-[27px] rounded-[4px] bg-white shadow transition-transform duration-150 ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </span>
    </button>
  );
}

/** Переключатель «Расход / Доход / Перевод», «Деньги / Дела». */
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
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col rounded-ctl bg-line p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 rounded-[4px] px-2 text-body font-medium transition-colors duration-150 ${
            o.value === value ? 'bg-surface text-ink shadow-sm' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** tone «soft» — выбранный чип светлый с акцентной рамкой: для уточнений рядом с тёмными вкладками и кнопками. */
export function Chip({
  selected,
  tone = 'primary',
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; tone?: 'primary' | 'soft' }) {
  const on = tone === 'soft' ? 'bg-accent/10 text-accent ring-1 ring-accent' : 'bg-primary text-white';
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-ctl px-3 text-body font-medium whitespace-nowrap ${
        selected ? on : 'bg-surface text-ink ring-1 ring-line'
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
    primary: 'bg-primary text-white disabled:bg-line disabled:text-muted',
    secondary: 'bg-surface text-ink ring-1 ring-line',
    danger: 'bg-surface text-warn ring-1 ring-line',
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

/** Поле ввода: высота 44, рамка 1 px, скругление 6 — везде одинаково. */
export const inputClass =
  'block min-h-11 w-full rounded-ctl bg-bg px-3 text-[16px] text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-accent disabled:opacity-60';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputClass} {...props} />;
}

/** Группа строк как в настройках iOS. */
export function ListGroup({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-2">
      {(title || action) && (
        <div className="flex items-end justify-between px-1">
          {title && <h2 className="text-caption font-medium text-muted">{title}</h2>}
          {action}
        </div>
      )}
      <div className="divide-y divide-line overflow-hidden rounded-card bg-surface">{children}</div>
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
  const cls = `flex min-h-13 w-full items-center gap-3 px-4 py-2.5 text-left ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} active:bg-bg`} aria-label={label}>
      {children}
    </button>
  ) : (
    <div className={cls}>{children}</div>
  );
}
