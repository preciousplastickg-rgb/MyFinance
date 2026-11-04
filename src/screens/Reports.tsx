import { ScreenHeader } from '../ui/ScreenHeader';
import { MoneyReport } from './reports/MoneyReport';

export function Reports() {
  return (
    <>
      <ScreenHeader title="Отчёты" />
      <div className="px-5">
        <MoneyReport />
      </div>
    </>
  );
}
