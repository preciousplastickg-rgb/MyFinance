import { formatMonthTitle, toLocalDate } from '../domain/date';
import { Placeholder } from '../ui/Placeholder';
import { ScreenHeader } from '../ui/ScreenHeader';

export function Money() {
  return (
    <>
      <ScreenHeader title="Деньги" subtitle={formatMonthTitle(toLocalDate(Date.now()))} />
      <div className="px-5">
        <Placeholder title="История операций" text="Пока пусто. Запись трат и доходов — этап 3." />
      </div>
    </>
  );
}
