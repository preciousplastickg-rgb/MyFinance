// Модель данных — раздел 3 SPEC. Балансы не хранятся, считаются из операций.

export type Id = string; // crypto.randomUUID()
export type Minor = number; // целое: сом×100 или USDT×100
export type Rate = number; // целое ×10 000, сом за 1 единицу валюты
/** Код валюты: 'KGS' — базовая, остальные — раздел 4.6 SPEC. */
export type Currency = string;
export type LocalDate = string; // 'YYYY-MM-DD', Asia/Bishkek

export interface Account {
  id: Id;
  name: string;
  /** savings — копилка (этап 20): отдельный счёт для накоплений, в лимит на день не входит. */
  type: 'bank' | 'cash' | 'crypto' | 'savings';
  currency: Currency;
  icon: string; // ключ значка (catalog.ts: имя lucide до этапа 29, имя Phosphor) или эмодзи
  color: string; // hex
  includeInDaily: boolean; // входит в лимит на день; KGS → true, USDT → false
  openingBalance: Minor;
  openingDate: LocalDate;
  sortOrder: number;
  archived: boolean;
  /** Только копилка: назначение, цель и срок (необязательно). */
  purpose?: SavingsPurpose;
  goal?: Minor;
  goalDate?: LocalDate;
}

export type SavingsPurpose = 'savings' | 'deposit' | 'cash' | 'fund';

export interface Category {
  id: Id;
  name: string;
  kind: 'expense' | 'income';
  icon: string;
  color: string;
  isFixed: boolean; // обязательный расход (только expense)
  /** Лимит в месяц в сомах, только expense (этап 23). Нет или 0 — без лимита. */
  limit?: Minor;
  sortOrder: number;
  archived: boolean;
}

export interface Transaction {
  id: Id;
  /** debt — деньги в долг или возврат долга (этап 17): двигает счёт, но не доход и не расход. */
  type: 'expense' | 'income' | 'transfer' | 'debt';
  date: LocalDate;
  accountId: Id;
  amount: Minor; // > 0, в валюте счёта
  categoryId?: Id; // нет у transfer
  toAccountId?: Id; // только transfer
  toAmount?: Minor; // в валюте счёта-получателя
  /**
   * Сом за 1 единицу валюты: у перевода валюта ↔ сом — курс обмена; у траты и дохода (этап 16) —
   * курс пересчёта, если валюта платежа или счёта не сом.
   */
  rate?: Rate;
  /** Трата или доход в другой валюте, чем счёт: сколько и в чём платили. amount — списано со счёта по rate. */
  origAmount?: Minor;
  origCurrency?: Currency;
  note?: string;
  recurringId?: Id; // если создана из регулярного платежа
  debtId?: Id; // только debt
  flow?: 'out' | 'in'; // только debt: деньги ушли со счёта или пришли на него
  dueDate?: LocalDate;
  createdAt: number;
  updatedAt: number;
}

/** Долг (этап 17): «мне должны» или «я должен». Остаток = opening + рост − возвраты по операциям debt. */
export interface Debt {
  id: Id;
  direction: 'owedToMe' | 'iOwe';
  person: string;
  currency: Currency;
  /** Сумма, с которой долг начался без движения по счетам («без счёта»: был до приложения, деньги не с учётных счетов). */
  opening: Minor;
  date: LocalDate;
  dueDate?: LocalDate;
  note?: string;
  /** Закрыт вручную, не дожидаясь возврата всего («простить», «списать»). Погашенный полностью закрыт и без этого. */
  closedAt?: number;
  createdAt: number;
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
  /** Последний день действия (включительно): рассрочка, подписка до даты. Нет — бессрочно. */
  endDate?: LocalDate;
  active: boolean;
  /** Удалён пользователем: скрыт везде, но запись остаётся — на неё ссылаются прошлые операции. */
  deletedAt?: number;
}

export interface OccurrenceLog {
  id: Id;
  recurringId: Id;
  dueDate: LocalDate;
  status: 'done' | 'skipped';
  transactionId?: Id;
  /** Доход зачислен сам в 17:00. Если такую операцию удалить, наступление считается пропущенным — второй раз само не зачислится. */
  auto?: boolean;
}

export interface RateEntry {
  rate: Rate; // ×10 000 сом за 1 единицу
  date: LocalDate;
}

export interface Settings {
  key: 'main'; // одна запись
  rates?: Record<Currency, RateEntry>; // последний курс каждой валюты (v3)
  lastUsdtRate?: Rate; // до v3; при миграции копируется в rates.USDT
  lastUsdtRateDate?: LocalDate;
  smallExpenseThreshold: Minor;
  theme: 'light' | 'dark' | 'system';
  /** Оформление (этап 26, SPEC 9a): тема и место кнопки «+». Нет — graphite / left. */
  palette?: 'graphite' | 'navy' | 'espresso';
  fabPosition?: 'left' | 'center' | 'right';
  lastBackupAt?: number;
  backupBannerHiddenUntil?: number; // «Закрыть на 24 часа»
  onboardingDone?: boolean;
  /** С этого дня доходы зачисляются сами в 17:00; более ранние неотмеченные остаются карточками «Пришло?». */
  autoIncomeSince?: LocalDate;
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
  date?: LocalDate; // без date = вкладка «Без даты»
  time?: string; // 'HH:mm'
  important: boolean;
  note?: string;
  repeat?: TaskRepeat;
  /** Цель, к которой ведёт дело (редизайн 2e, «Цели»). */
  goalId?: Id;
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

// Фаза 2b: привычки (схема Dexie v2)

export interface Habit {
  id: Id;
  name: string;
  icon: string;
  color: string;
  /**
   * С v5 у всех привычек 'daily': отметка — просто галочка за день (этап 14).
   * Старые виды остаются в типе для данных до v5 и бэкапов; прежний вид сохранён в legacyKind.
   */
  kind: 'daily' | 'weekly' | 'count' | 'abstain';
  /** Дни недели, когда привычку ждём: 1 = пн … 7 = вс. Нет или пусто — каждый день. */
  days?: number[];
  /** Подпись к привычке: «3 литра», «20 страниц». Только для глаз — в расчётах не участвует. */
  note?: string;
  /** Цель, к которой ведёт привычка (редизайн 2e). */
  goalId?: Id;
  /** Привычка «Без кафе»: если сегодня есть трата в этой категории — предупреждение цветом --warn. */
  watchCategoryId?: Id;
  /** Вид до миграции v5. Для 'count' день засчитан, когда сумма за день ≥ target (старые записи «+1»). */
  legacyKind?: 'weekly' | 'count' | 'abstain';
  target?: number; // до v5 — weekly: раз в неделю (1–7); count: сколько в день
  unit?: string; // до v5 — count: «стаканов», «страниц»
  workoutType?: 'gym' | 'pool' | 'any'; // устарело: тренировки убраны в этапе 13, дни перенесены в HabitLog (v4)
  startDate: LocalDate;
  sortOrder: number;
  archived: boolean;
}

export interface HabitLog {
  id: Id;
  habitId: Id;
  date: LocalDate;
  /** Отметка за день: ≥ 1 — выполнено. До v5 у «количества» — число за день; у «дней без» 1 = срыв (в v5 стал 0). */
  value: number;
  at: number;
}

// Тренировки (зал, бассейн) убраны из приложения в этапе 13. Таблицы и типы остаются,
// чтобы старые данные не потерялись: они лежат в базе и попадают в бэкап.

export interface Exercise {
  id: Id;
  name: string;
  icon: string;
  sortOrder: number;
  archived: boolean;
}

export interface Workout {
  id: Id;
  date: LocalDate;
  type: 'gym' | 'pool';
  distanceM?: number; // pool, метры
  durationS?: number; // pool, секунды
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorkoutSet {
  id: Id;
  workoutId: Id;
  exerciseId: Id;
  order: number;
  weightG: number; // граммы: 42,5 кг = 42 500
  reps: number;
}

/**
 * Цель (редизайн 2e): собирает копилку, привычки и дела в один прогресс — среднее по имеющимся частям.
 * Копилка — обычный счёт type 'savings' (jarAccountId); привычки и дела ссылаются на цель через goalId.
 */
export interface Goal {
  id: Id;
  name: string;
  icon: string;
  color: string;
  dueDate?: LocalDate;
  jarAccountId?: Id;
  createdAt: number;
  archived?: boolean;
}
