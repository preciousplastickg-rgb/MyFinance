import { useNav, type ReportsMode } from '../app/nav';
import { SectionPager } from '../app/SectionPager';
import { Segmented } from '../ui/controls';
import { ScreenHeader } from '../ui/ScreenHeader';
import { HabitsReport } from './reports/HabitsReport';
import { MoneyReport } from './reports/MoneyReport';
import { TasksReport } from './reports/TasksReport';

const KINDS: readonly ReportsMode[] = ['money', 'tasks', 'habits'];

export function Reports() {
  const { reportsMode: kind, showReports: setKind } = useNav();
  return (
    <>
      <ScreenHeader title="Отчёты" />
      <div className="space-y-4 px-4">
        <Segmented
          label="Отчёт"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'money', label: 'Деньги' },
            { value: 'tasks', label: 'Дела' },
            { value: 'habits', label: 'Привычки' },
          ]}
        />
        <SectionPager items={KINDS} current={kind} render={(k) => (k === 'money' ? <MoneyReport /> : k === 'tasks' ? <TasksReport /> : <HabitsReport />)} />
      </div>
    </>
  );
}
