import { useState } from 'react';
import { Segmented } from '../ui/controls';
import { ScreenHeader } from '../ui/ScreenHeader';
import { MoneyReport } from './reports/MoneyReport';
import { TasksReport } from './reports/TasksReport';

export function Reports() {
  const [kind, setKind] = useState<'money' | 'tasks'>('money');
  return (
    <>
      <ScreenHeader title="Отчёты" />
      <div className="space-y-4 px-5">
        <Segmented
          label="Отчёт"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'money', label: 'Деньги' },
            { value: 'tasks', label: 'Дела' },
          ]}
        />
        {kind === 'money' ? <MoneyReport /> : <TasksReport />}
      </div>
    </>
  );
}
