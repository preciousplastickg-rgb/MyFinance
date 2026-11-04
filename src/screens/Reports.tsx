import { Placeholder } from '../ui/Placeholder';
import { ScreenHeader } from '../ui/ScreenHeader';

export function Reports() {
  return (
    <>
      <ScreenHeader title="Отчёты" />
      <div className="px-5">
        <Placeholder title="Куда уходят деньги" text="Отчёты по категориям — этап 6." />
      </div>
    </>
  );
}
