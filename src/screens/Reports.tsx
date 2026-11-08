import type { ReportsMode } from '../app/nav';
import { ScreenHeader } from '../ui/ScreenHeader';
import { HabitsReport } from './reports/HabitsReport';
import { MoneyReport } from './reports/MoneyReport';
import { TasksReport } from './reports/TasksReport';

/** «Отчёты» — одна страница ленты на отчёт (этап 31): деньги, дела, привычки; разделы — в панели внизу, над меню. */
export function Reports({ mode }: { mode: ReportsMode }) {
  return (
    <>
      <ScreenHeader title="Отчёты" />
      <div className="space-y-4 px-4">{mode === 'money' ? <MoneyReport /> : mode === 'tasks' ? <TasksReport /> : <HabitsReport />}</div>
    </>
  );
}
