import { useEffect } from 'react';
import { autoCompleteIncome, updateSettings } from '../data/actions';
import { useData } from '../data/DataProvider';
import { bishkekTime, minutesOfDay } from '../domain/date';
import { formatMoney } from '../domain/money';
import { autoIncomes, INCOME_MINUTES, occurrences } from '../domain/recurring';
import { useToast } from '../ui/Toast';
import { useIncomeTimePassed, useToday } from './nav';

/**
 * Зарплата и другие доходы зачисляются сами в 17:00 дня поступления (этап 15).
 * Приложение открыли позже — доход записывается задним числом, датой поступления и временем 17:00.
 */
export function useAutoIncome() {
  const { recurring, occurrenceLog, settings, accounts } = useData();
  const today = useToday();
  const passed = useIncomeTimePassed();
  const toast = useToast();
  const since = settings.autoIncomeSince;
  const ready = settings.onboardingDone || accounts.length > 0;

  useEffect(() => {
    if (!ready) return;
    if (!since) {
      void updateSettings({ autoIncomeSince: today });
      return;
    }
    const due = autoIncomes(occurrences(recurring, occurrenceLog, today), today, minutesOfDay(Date.now()), since);
    if (!due.length) return;
    void (async () => {
      for (const o of due) {
        const tx = await autoCompleteIncome(o.recurring, o.dueDate, bishkekTime(o.dueDate, INCOME_MINUTES));
        if (tx) toast({ message: `Зачислено: ${o.recurring.name} +${formatMoney(tx.amount, o.recurring.currency)}` });
      }
    })();
  }, [ready, since, recurring, occurrenceLog, today, passed, toast]);
}
