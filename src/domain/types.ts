// Модель данных — раздел 3 SPEC. Балансы не хранятся, считаются из операций.

export type Id = string; // crypto.randomUUID()
export type Minor = number; // целое: сом×100 или USDT×100
export type Rate = number; // целое ×10 000, сом за 1 USDT
export type Currency = 'KGS' | 'USDT';
export type LocalDate = string; // 'YYYY-MM-DD', Asia/Bishkek

export interface Account {
  id: Id;
  name: string;
  type: 'bank' | 'cash' | 'crypto';
  currency: Currency;
  icon: string; // имя значка lucide
  color: string; // hex
  includeInDaily: boolean; // входит в лимит на день; KGS → true, USDT → false
  openingBalance: Minor;
  openingDate: LocalDate;
  sortOrder: number;
  archived: boolean;
}

export interface Category {
  id: Id;
  name: string;
  kind: 'expense' | 'income';
  icon: string;
  color: string;
  isFixed: boolean; // обязательный расход (только expense)
  sortOrder: number;
  archived: boolean;
}

export interface Transaction {
  id: Id;
  type: 'expense' | 'income' | 'transfer';
  date: LocalDate;
  accountId: Id;
  amount: Minor; // > 0, в валюте счёта
  categoryId?: Id; // нет у transfer
  toAccountId?: Id; // только transfer
  toAmount?: Minor; // в валюте счёта-получателя
  rate?: Rate; // только между разными валютами
  note?: string;
  recurringId?: Id; // если создана из регулярного платежа
  dueDate?: LocalDate;
  createdAt: number;
  updatedAt: number;
}

export type RecurringSchedule =
  | { type: 'monthly'; day: number } // 1..31, 31 в коротком месяце = последний день
  | { type: 'weekly'; weekday: number } // 1 = пн
  | { type: 'yearly'; month: number; day: number };

export interface Recurring {
  id: Id;
  kind: 'expense' | 'income';
  name: string;
  amount: Minor; // ожидаемая сумма
  currency: Currency;
  accountId: Id;
  categoryId: Id;
  schedule: RecurringSchedule;
  isMandatory: boolean; // expense: резервируется в лимите на день
  isSubscription: boolean;
  startDate: LocalDate;
  active: boolean;
}

export interface OccurrenceLog {
  id: Id;
  recurringId: Id;
  dueDate: LocalDate;
  status: 'done' | 'skipped';
  transactionId?: Id;
}

export interface Settings {
  key: 'main'; // одна запись
  lastUsdtRate?: Rate;
  lastUsdtRateDate?: LocalDate;
  smallExpenseThreshold: Minor;
  theme: 'light' | 'dark' | 'system';
  lastBackupAt?: number;
  backupBannerHiddenUntil?: number; // «Закрыть на 24 часа»
  onboardingDone?: boolean;
}

// Фаза 2

export interface Area {
  id: Id;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  archived: boolean;
}

export type TaskRepeat =
  | { type: 'daily' }
  | { type: 'weekly'; weekdays: number[] }
  | { type: 'monthly'; day: number };

export interface Task {
  id: Id;
  title: string;
  areaId?: Id;
  icon?: string; // свой значок вместо значка сферы
  date?: LocalDate; // без date = Входящие
  time?: string; // 'HH:mm'
  important: boolean;
  note?: string;
  repeat?: TaskRepeat;
  status: 'open' | 'done' | 'deleted';
  postponeCount: number;
  createdAt: number;
  doneAt?: number;
}

export interface TaskEvent {
  id: Id;
  taskId: Id;
  type: 'created' | 'done' | 'undone' | 'postponed' | 'deleted';
  date: LocalDate; // день события
  fromDate?: LocalDate; // для postponed
  toDate?: LocalDate;
  at: number;
}
