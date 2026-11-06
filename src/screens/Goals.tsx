import { ScreenHeader } from '../ui/ScreenHeader';

/** «Цели» — заполняется на шаге «Цели» переноса дизайна. */
export function Goals() {
  return (
    <>
      <ScreenHeader title="Цели" />
      <p className="px-5 text-caption text-muted">Цель собирает копилку, привычки и дела в один прогресс.</p>
    </>
  );
}
