import type { ReactNode } from 'react';

export function ScreenHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="pt-safe px-4">
      <div className="flex items-end justify-between gap-3 pt-4 pb-3">
        <div>
          {subtitle && <p className="text-caption text-muted">{subtitle}</p>}
          <h1 className="text-h1 font-bold">{title}</h1>
        </div>
        {action}
      </div>
    </header>
  );
}
