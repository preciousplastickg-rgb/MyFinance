import { useNav, type ReportsMode } from '../app/nav';
import { SectionPager } from '../app/SectionPager';
import { useSubNav } from '../app/useSubNav';
import { ScreenHeader } from '../ui/ScreenHeader';
import { HabitsReport } from './reports/HabitsReport';
import { MoneyReport } from './reports/MoneyReport';
import { TasksReport } from './reports/TasksReport';

const KINDS: readonly ReportsMode[] = ['money', 'tasks', 'habits'];
const KIND_TITLES: readonly { value: ReportsMode; label: string }[] = [
  { value: 'money', label: 'Деньги' },
  { value: 'tasks', label: 'Дела' },
  { value: 'habits', label: 'Привычки' },
];

/** «Отчёты»: деньги, дела, привычки — разделы внизу, над меню (этап 29). */
export function Reports() {
  const { reportsMode: kind, showReports: setKind } = useNav();
  useSubNav('Отчёт', KIND_TITLES, kind, setKind);
  return (
    <>
      <ScreenHeader title="Отчёты" />
      <div className="space-y-4 px-4">
        <SectionPager items={KINDS} current={kind} render={(k) => (k === 'money' ? <MoneyReport /> : k === 'tasks' ? <TasksReport /> : <HabitsReport />)} />
      </div>
    </>
  );
}
