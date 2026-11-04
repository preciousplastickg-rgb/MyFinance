import type { Account, Area, Category } from './types';

/** Палитра категорий и сфер (SPEC 9). */
export const PALETTE = ['#2448D6', '#0B7A4B', '#B45309', '#6D3FC4', '#0E7490', '#BE185D', '#172554', '#5B6170'] as const;

/** Фон кружка значка — цвет с прозрачностью 12%. */
export function tint(color: string): string {
  return `${color}1F`;
}

type BaseCategory = Pick<Category, 'name' | 'kind' | 'icon' | 'color' | 'isFixed'>;

export const BASE_CATEGORIES: readonly BaseCategory[] = [
  { name: 'Продукты', kind: 'expense', icon: 'ShoppingCart', color: '#0B7A4B', isFixed: false },
  { name: 'Кафе', kind: 'expense', icon: 'Coffee', color: '#B45309', isFixed: false },
  { name: 'Транспорт', kind: 'expense', icon: 'Bus', color: '#2448D6', isFixed: false },
  { name: 'Жильё', kind: 'expense', icon: 'House', color: '#172554', isFixed: true },
  { name: 'Связь и интернет', kind: 'expense', icon: 'Wifi', color: '#0E7490', isFixed: true },
  { name: 'Подписки', kind: 'expense', icon: 'Repeat', color: '#6D3FC4', isFixed: true },
  { name: 'Здоровье', kind: 'expense', icon: 'HeartPulse', color: '#BE185D', isFixed: false },
  { name: 'Одежда', kind: 'expense', icon: 'Shirt', color: '#6D3FC4', isFixed: false },
  { name: 'Дом', kind: 'expense', icon: 'Sofa', color: '#0E7490', isFixed: false },
  { name: 'Развлечения', kind: 'expense', icon: 'Gamepad2', color: '#BE185D', isFixed: false },
  { name: 'Подарки', kind: 'expense', icon: 'Gift', color: '#B45309', isFixed: false },
  { name: 'Комиссии', kind: 'expense', icon: 'Percent', color: '#5B6170', isFixed: false },
  { name: 'Прочее', kind: 'expense', icon: 'Ellipsis', color: '#5B6170', isFixed: false },
  { name: 'Зарплата', kind: 'income', icon: 'Briefcase', color: '#0B7A4B', isFixed: false },
  { name: 'Подработка', kind: 'income', icon: 'Laptop', color: '#2448D6', isFixed: false },
  { name: 'Другое', kind: 'income', icon: 'Coins', color: '#5B6170', isFixed: false },
];

type DefaultAccount = Pick<Account, 'name' | 'type' | 'currency' | 'icon' | 'color' | 'includeInDaily'>;

/** Предзаполнение первого запуска (SPEC 5.5). */
export const DEFAULT_ACCOUNTS: readonly DefaultAccount[] = [
  { name: 'MBank', type: 'bank', currency: 'KGS', icon: 'Landmark', color: '#0B7A4B', includeInDaily: true },
  { name: 'О!Банк', type: 'bank', currency: 'KGS', icon: 'Landmark', color: '#BE185D', includeInDaily: true },
  { name: 'Оптима', type: 'bank', currency: 'KGS', icon: 'Landmark', color: '#2448D6', includeInDaily: true },
  { name: 'Наличные', type: 'cash', currency: 'KGS', icon: 'Banknote', color: '#B45309', includeInDaily: true },
  { name: 'USDT', type: 'crypto', currency: 'USDT', icon: 'Coins', color: '#0E7490', includeInDaily: false },
];

/** Необязательные валютные счета на первом шаге — по умолчанию выключены (SPEC 4.6). */
export const EXTRA_ACCOUNTS: readonly DefaultAccount[] = [
  { name: 'Доллары', type: 'cash', currency: 'USD', icon: 'Banknote', color: '#0B7A4B', includeInDaily: false },
  { name: 'Евро', type: 'cash', currency: 'EUR', icon: 'Banknote', color: '#2448D6', includeInDaily: false },
];

export const BASE_AREAS: readonly Pick<Area, 'name' | 'icon' | 'color'>[] = [
  { name: 'Работа', icon: 'Briefcase', color: '#2448D6' },
  { name: 'Дом', icon: 'House', color: '#0E7490' },
  { name: 'Здоровье', icon: 'HeartPulse', color: '#BE185D' },
  { name: 'Личное', icon: 'User', color: '#6D3FC4' },
];

/** Отбор значков для категорий, счетов и сфер с ключевыми словами для поиска. */
export const ICON_KEYWORDS: Readonly<Record<string, string>> = {
  ShoppingCart: 'продукты магазин еда супермаркет',
  ShoppingBag: 'покупки шопинг пакет',
  Coffee: 'кафе кофе чай',
  UtensilsCrossed: 'ресторан еда обед ужин',
  Pizza: 'пицца доставка фастфуд',
  Apple: 'фрукты овощи рынок',
  Beer: 'бар пиво алкоголь',
  Bus: 'транспорт автобус маршрутка',
  CarTaxiFront: 'такси',
  Car: 'машина авто автомобиль',
  Fuel: 'бензин топливо заправка',
  Train: 'поезд электричка',
  Plane: 'самолёт путешествия отпуск билеты',
  Bike: 'велосипед самокат',
  House: 'жильё дом аренда квартира',
  Sofa: 'мебель дом интерьер',
  Wrench: 'ремонт мастер инструменты',
  Hammer: 'стройка ремонт',
  Zap: 'электричество свет коммуналка',
  Droplet: 'вода коммуналка',
  Flame: 'газ отопление коммуналка',
  Receipt: 'счета квитанции чек',
  Wifi: 'интернет связь',
  Smartphone: 'связь телефон мобильный',
  Phone: 'телефон звонки',
  Tv: 'телевизор кино подписки',
  Repeat: 'подписки регулярно',
  Cloud: 'облако хранилище подписки',
  Music: 'музыка подписки',
  Film: 'кино фильмы',
  Ticket: 'билеты концерт театр',
  Gamepad2: 'игры развлечения',
  Camera: 'фото хобби',
  Palette: 'хобби творчество',
  HeartPulse: 'здоровье медицина',
  Pill: 'аптека лекарства',
  Stethoscope: 'врач больница клиника',
  Dumbbell: 'спорт зал фитнес тренажёр',
  Waves: 'бассейн плавание вода',
  Ban: 'отказ без запрет',
  Timer: 'время таймер',
  Footprints: 'шаги ходьба прогулка',
  Bed: 'сон кровать',
  Scissors: 'стрижка красота салон',
  Sparkles: 'уход косметика красота',
  Shirt: 'одежда вещи',
  Baby: 'дети ребёнок',
  PawPrint: 'животные питомец кот собака',
  GraduationCap: 'образование учёба курсы',
  BookOpen: 'книги чтение',
  Gift: 'подарки праздник',
  Heart: 'семья любовь благотворительность',
  Users: 'друзья семья люди',
  User: 'личное я',
  Percent: 'комиссии проценты',
  HandCoins: 'долг займ помощь',
  Briefcase: 'зарплата работа',
  Laptop: 'подработка фриланс компьютер',
  Building2: 'офис компания работа',
  TrendingUp: 'инвестиции доход рост',
  Coins: 'деньги монеты другое',
  Wallet: 'кошелёк деньги',
  Landmark: 'банк счёт',
  Banknote: 'наличные деньги купюры',
  CreditCard: 'карта банк',
  PiggyBank: 'копилка накопления',
  Bitcoin: 'крипта криптовалюта',
  Shield: 'страховка защита',
  Key: 'ключи аренда',
  Package: 'посылка доставка',
  Globe: 'путешествия интернет',
  Leaf: 'природа сад растения',
  Target: 'цели',
  Lightbulb: 'идеи',
  Star: 'важное избранное',
  CalendarCheck: 'дела события',
  Ellipsis: 'прочее другое',
};

export const ICON_NAMES = Object.keys(ICON_KEYWORDS);

export function searchIcons(query: string): string[] {
  const q = query.trim().toLowerCase().replace(/ё/g, 'е');
  if (!q) return ICON_NAMES;
  return ICON_NAMES.filter((name) => {
    const words = ICON_KEYWORDS[name]!.replace(/ё/g, 'е');
    return words.split(' ').some((w) => w.startsWith(q)) || name.toLowerCase().includes(q);
  });
}
