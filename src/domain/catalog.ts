import type { Account, Area, Category } from './types';

/** Палитра категорий, счетов, сфер, привычек и целей — токены `--c-*` из tokens.css (SPEC 9). */
export const PALETTE = ['blue', 'green', 'amber', 'violet', 'teal', 'rose', 'slate', 'orange', 'sky', 'plum'] as const;
export type PaletteKey = (typeof PALETTE)[number];

export const PALETTE_NAMES: Readonly<Record<PaletteKey, string>> = {
  blue: 'Синий', green: 'Зелёный', amber: 'Янтарный', violet: 'Фиолетовый', teal: 'Бирюзовый',
  rose: 'Розовый', slate: 'Серый', orange: 'Оранжевый', sky: 'Голубой', plum: 'Сливовый',
};

/** CSS-значение цвета: имя токена → `var(--c-…)`; hex из старых данных — как есть. */
export function colorCss(color: string): string {
  return (PALETTE as readonly string[]).includes(color) ? `var(--c-${color})` : color;
}

/** Фон кружка значка — цвет 13% (tokens.css, класс .ic). */
export function tint(color: string): string {
  return `color-mix(in srgb, ${colorCss(color)} 13%, transparent)`;
}

type BaseCategory = Pick<Category, 'name' | 'kind' | 'icon' | 'color' | 'isFixed'>;

export const BASE_CATEGORIES: readonly BaseCategory[] = [
  { name: 'Продукты', kind: 'expense', icon: 'ShoppingCart', color: 'green', isFixed: false },
  { name: 'Кафе', kind: 'expense', icon: 'Coffee', color: 'amber', isFixed: false },
  { name: 'Транспорт', kind: 'expense', icon: 'Bus', color: 'blue', isFixed: false },
  { name: 'Жильё', kind: 'expense', icon: 'House', color: 'teal', isFixed: true },
  { name: 'Связь и интернет', kind: 'expense', icon: 'Wifi', color: 'blue', isFixed: true },
  { name: 'Подписки', kind: 'expense', icon: 'Repeat', color: 'violet', isFixed: true },
  { name: 'Здоровье', kind: 'expense', icon: 'HeartPulse', color: 'rose', isFixed: false },
  { name: 'Одежда', kind: 'expense', icon: 'Shirt', color: 'plum', isFixed: false },
  { name: 'Дом', kind: 'expense', icon: 'Sofa', color: 'teal', isFixed: false },
  { name: 'Развлечения', kind: 'expense', icon: 'Popcorn', color: 'violet', isFixed: false },
  { name: 'Подарки', kind: 'expense', icon: 'Gift', color: 'rose', isFixed: false },
  { name: 'Комиссии', kind: 'expense', icon: 'Percent', color: 'slate', isFixed: false },
  { name: 'Прочее', kind: 'expense', icon: 'Ellipsis', color: 'slate', isFixed: false },
  { name: 'Зарплата', kind: 'income', icon: 'Banknote', color: 'green', isFixed: false },
  { name: 'Подработка', kind: 'income', icon: 'Briefcase', color: 'green', isFixed: false },
  { name: 'Другое', kind: 'income', icon: 'CircleDot', color: 'slate', isFixed: false },
];

type DefaultAccount = Pick<Account, 'name' | 'type' | 'currency' | 'icon' | 'color' | 'includeInDaily'>;

/** Предзаполнение первого запуска (SPEC 5.5). */
export const DEFAULT_ACCOUNTS: readonly DefaultAccount[] = [
  { name: 'MBank', type: 'bank', currency: 'KGS', icon: 'Landmark', color: 'blue', includeInDaily: true },
  { name: 'О!Банк', type: 'bank', currency: 'KGS', icon: 'Landmark', color: 'rose', includeInDaily: true },
  { name: 'Оптима', type: 'bank', currency: 'KGS', icon: 'Landmark', color: 'green', includeInDaily: true },
  { name: 'Наличные', type: 'cash', currency: 'KGS', icon: 'Banknote', color: 'amber', includeInDaily: true },
  { name: 'USDT', type: 'crypto', currency: 'USDT', icon: 'Coins', color: 'teal', includeInDaily: false },
];

/** Необязательные валютные счета на первом шаге — по умолчанию выключены (SPEC 4.6). */
export const EXTRA_ACCOUNTS: readonly DefaultAccount[] = [
  { name: 'Доллары', type: 'cash', currency: 'USD', icon: 'Banknote', color: 'green', includeInDaily: false },
  { name: 'Евро', type: 'cash', currency: 'EUR', icon: 'Banknote', color: 'blue', includeInDaily: false },
];

export const BASE_AREAS: readonly Pick<Area, 'name' | 'icon' | 'color'>[] = [
  { name: 'Работа', icon: 'Briefcase', color: 'blue' },
  { name: 'Дом', icon: 'House', color: 'teal' },
  { name: 'Здоровье', icon: 'HeartPulse', color: 'rose' },
  { name: 'Личное', icon: 'User', color: 'violet' },
];

/**
 * Значки категорий, счетов, сфер, привычек и целей с русскими словами для поиска (SPEC 5.4). Порядок — порядок в сетке.
 * Ключ — то, что хранится в базе. Старые ключи — имена lucide (до этапа 29), им сопоставлен значок Phosphor в ICON_ALIASES;
 * новые ключи — сразу имена Phosphor. Данные не мигрируются: «Landmark» в базе рисуется значком «Bank».
 */
export const ICON_KEYWORDS: Readonly<Record<string, string>> = {
  // еда и покупки
  ShoppingCart: 'продукты магазин еда супермаркет',
  ShoppingBag: 'покупки шопинг пакет',
  Basket: 'корзина рынок базар',
  Storefront: 'магазин лавка маркет',
  Tote: 'сумка шоппер покупки',
  Coffee: 'кафе кофе чай',
  UtensilsCrossed: 'ресторан еда обед ужин',
  Hamburger: 'фастфуд бургер перекус',
  Pizza: 'пицца доставка',
  BowlFood: 'лапша рамен азиатская еда',
  CookingPot: 'готовка кухня суп',
  Bread: 'хлеб выпечка пекарня',
  Carrot: 'овощи морковь',
  Apple: 'фрукты рынок апельсин',
  Avocado: 'здоровое питание авокадо',
  Cherries: 'ягоды вишня',
  Egg: 'яйца завтрак',
  Fish: 'рыба морепродукты',
  Cake: 'торт десерт праздник',
  IceCream: 'мороженое сладкое',
  Cookie: 'печенье сладости',
  Beer: 'бар пиво алкоголь',
  Wine: 'вино алкоголь',
  Martini: 'коктейль бар',
  // транспорт и поездки
  Bus: 'транспорт автобус маршрутка',
  CarTaxiFront: 'такси',
  Car: 'машина авто автомобиль',
  CarProfile: 'автомобиль седан',
  Jeep: 'джип внедорожник',
  Fuel: 'бензин топливо заправка',
  Garage: 'гараж парковка стоянка',
  Train: 'поезд электричка',
  Subway: 'метро',
  Plane: 'самолёт путешествия отпуск билеты',
  AirplaneTilt: 'перелёт рейс авиабилеты',
  Bike: 'велосипед',
  Scooter: 'самокат',
  Motorcycle: 'мотоцикл мопед',
  Van: 'доставка переезд микроавтобус',
  Truck: 'грузовик перевозка',
  Boat: 'лодка яхта',
  MapPin: 'место адрес',
  Suitcase: 'чемодан командировка',
  SuitcaseRolling: 'багаж путешествие',
  Tent: 'кемпинг поход палатка',
  Globe: 'путешествия интернет мир',
  // дом и коммуналка
  House: 'жильё дом аренда квартира',
  Sofa: 'мебель дом интерьер диван',
  Armchair: 'кресло мебель',
  Bed: 'сон кровать',
  Lamp: 'лампа свет',
  Door: 'дверь вход',
  Key: 'ключи аренда',
  Wrench: 'ремонт мастер инструменты',
  Hammer: 'стройка ремонт',
  Toolbox: 'инструменты ремонт',
  PaintRoller: 'краска ремонт',
  Zap: 'электричество свет коммуналка',
  Droplet: 'вода коммуналка',
  Flame: 'газ отопление коммуналка',
  Thermometer: 'отопление температура',
  Snowflake: 'кондиционер холод',
  Fan: 'вентилятор',
  Plug: 'розетка электричество',
  WashingMachine: 'стирка прачечная',
  Broom: 'уборка клининг',
  Shower: 'душ ванная',
  Bathtub: 'ванна сантехника',
  ToiletPaper: 'бытовая химия хозтовары',
  Receipt: 'счета квитанции чек',
  Invoice: 'счёт квитанция налоги',
  // связь и подписки
  Wifi: 'интернет связь',
  Smartphone: 'связь телефон мобильный',
  Phone: 'телефон звонки',
  DeviceTablet: 'планшет',
  Laptop: 'подработка фриланс компьютер ноутбук',
  Desktop: 'компьютер техника',
  Printer: 'принтер печать',
  Tv: 'телевизор кино подписки',
  Repeat: 'подписки регулярно',
  Cloud: 'облако хранилище подписки',
  Music: 'музыка подписки',
  Headphones: 'наушники музыка',
  Film: 'кино фильмы',
  Ticket: 'билеты концерт театр',
  Gamepad2: 'игры развлечения',
  Popcorn: 'развлечения кино попкорн',
  Envelope: 'почта письма',
  // здоровье, спорт, уход
  HeartPulse: 'здоровье медицина',
  Pill: 'аптека лекарства',
  Stethoscope: 'врач больница клиника',
  FirstAidKit: 'аптечка медицина',
  Hospital: 'больница клиника',
  Syringe: 'прививка анализы укол',
  Bandaids: 'пластырь травма',
  Tooth: 'стоматолог зубы',
  Eyeglasses: 'очки оптика зрение',
  Dumbbell: 'спорт зал фитнес тренажёр',
  PersonSimpleRun: 'бег пробежка',
  PersonSimpleBike: 'велотренировка',
  PersonSimpleSwim: 'плавание',
  PersonStanding: 'растяжка зарядка йога тело',
  Waves: 'бассейн плавание вода море',
  SoccerBall: 'футбол',
  Basketball: 'баскетбол',
  Volleyball: 'волейбол',
  TennisBall: 'теннис',
  Medal: 'медаль соревнования',
  Trophy: 'победа кубок',
  Footprints: 'шаги ходьба прогулка',
  Timer: 'время таймер',
  Ban: 'отказ без запрет',
  Cigarette: 'сигареты курение',
  Brain: 'психолог мозг учёба',
  Scissors: 'стрижка красота салон',
  Sparkles: 'уход косметика красота',
  Sunglasses: 'очки отдых лето',
  // одежда и вещи
  Shirt: 'одежда вещи футболка',
  Hoodie: 'худи толстовка одежда',
  Pants: 'брюки джинсы',
  Dress: 'платье одежда',
  Sneaker: 'обувь кроссовки',
  Sock: 'носки',
  Handbag: 'сумка аксессуары',
  Watch: 'часы аксессуары',
  Diamond: 'украшения ювелирка',
  Crown: 'премиум роскошь',
  // семья, питомцы, учёба, отдых
  Baby: 'дети ребёнок',
  BabyCarriage: 'коляска малыш',
  PawPrint: 'животные питомец',
  Dog: 'собака',
  Cat: 'кошка кот',
  Bird: 'птица попугай',
  Horse: 'лошадь конный',
  GraduationCap: 'образование учёба курсы',
  Student: 'школа ученик',
  Chalkboard: 'репетитор уроки',
  BookOpen: 'книги чтение',
  Books: 'библиотека книги учебники',
  Notebook: 'тетрадь канцелярия',
  Certificate: 'диплом сертификат',
  Guitar: 'гитара музыка хобби',
  Microphone: 'караоке подкаст',
  Camera: 'фото хобби',
  Palette: 'хобби творчество рисование',
  PuzzlePiece: 'игрушки пазлы',
  DiceFive: 'настольные игры',
  Mountain: 'горы поход природа',
  Tree: 'парк природа',
  TreePalm: 'отпуск пляж море',
  Plant: 'растения сад',
  Leaf: 'природа экология',
  Flower: 'цветы',
  FlowerTulip: 'букет цветы',
  Sun: 'лето солнце отдых',
  Umbrella: 'зонт страховка',
  Gift: 'подарки праздник',
  Confetti: 'праздник вечеринка',
  Balloon: 'день рождения',
  Heart: 'семья любовь',
  HandHeart: 'благотворительность помощь садака',
  Users: 'друзья семья люди',
  User: 'личное я',
  Smiley: 'настроение радость',
  // работа и деньги
  Briefcase: 'зарплата работа',
  Building2: 'офис компания работа',
  Handshake: 'сделка партнёр',
  Gavel: 'юрист суд штраф',
  Scales: 'налоги закон',
  Calculator: 'бухгалтерия расчёты',
  Percent: 'комиссии проценты',
  HandCoins: 'долг займ помощь',
  TrendingUp: 'инвестиции доход рост',
  ChartLineUp: 'акции биржа',
  Coins: 'деньги монеты другое',
  Coin: 'монета мелочь',
  Wallet: 'кошелёк деньги',
  Landmark: 'банк счёт',
  Banknote: 'наличные деньги купюры',
  CreditCard: 'карта банк',
  PiggyBank: 'копилка накопления',
  Vault: 'сейф депозит',
  Bitcoin: 'крипта криптовалюта',
  Shield: 'страховка защита',
  Lock: 'безопасность',
  Package: 'посылка доставка',
  Rocket: 'стартап мечта',
  Target: 'цели',
  Lightbulb: 'идеи',
  Star: 'важное избранное',
  CalendarCheck: 'дела события',
  Hourglass: 'срок ожидание',
  Alarm: 'будильник утро',
  Bell: 'напоминание',
  Infinity: 'навсегда бесконечность',
  CircleDot: 'другое прочее',
  Ellipsis: 'прочее другое',
};

/** Старые ключи (имена lucide до этапа 29) → значок Phosphor. Остальные ключи совпадают с именем Phosphor. */
export const ICON_ALIASES: Readonly<Record<string, string>> = {
  UtensilsCrossed: 'ForkKnife', Apple: 'OrangeSlice', Beer: 'BeerStein', CarTaxiFront: 'Taxi', Fuel: 'GasPump', Plane: 'Airplane',
  Bike: 'Bicycle', Sofa: 'Couch', Zap: 'Lightning', Droplet: 'Drop', Wifi: 'WifiHigh', Smartphone: 'DeviceMobile', Tv: 'Television',
  Music: 'MusicNotes', Film: 'FilmSlate', Gamepad2: 'GameController', CircleDot: 'DotOutline', Mountain: 'Mountains',
  PersonStanding: 'PersonSimpleTaiChi', HeartPulse: 'Heartbeat', Dumbbell: 'Barbell', Ban: 'Prohibit', Sparkles: 'Sparkle', Shirt: 'TShirt',
  Building2: 'Buildings', TrendingUp: 'TrendUp', Landmark: 'Bank', Banknote: 'Money', Bitcoin: 'CurrencyBtc', Ellipsis: 'DotsThree',
  ArrowLeftRight: 'ArrowsLeftRight',
};

/** Имя значка Phosphor для ключа из базы. */
export function glyphName(icon: string): string {
  return ICON_ALIASES[icon] ?? icon;
}

export const ICON_NAMES = Object.keys(ICON_KEYWORDS);

const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, 'е');

export function searchIcons(query: string): string[] {
  const q = norm(query);
  if (!q) return ICON_NAMES;
  return ICON_NAMES.filter((name) => {
    const words = norm(ICON_KEYWORDS[name]!);
    return words.split(' ').some((w) => w.startsWith(q)) || name.toLowerCase().includes(q);
  });
}

/** Эмодзи вместо значка (этап 29): в кружке цвета, как значок. Хранится сам символ. */
export const EMOJI: readonly (readonly [emoji: string, words: string])[] = [
  ['🛒', 'продукты магазин'], ['🍎', 'фрукты яблоко'], ['🥦', 'овощи'], ['🥩', 'мясо'], ['🥖', 'хлеб'], ['🧀', 'сыр'], ['🥛', 'молоко'],
  ['☕', 'кофе кафе'], ['🍵', 'чай'], ['🍔', 'бургер фастфуд'], ['🍕', 'пицца'], ['🍜', 'лапша'], ['🍣', 'суши'], ['🥗', 'салат'], ['🍰', 'торт десерт'],
  ['🍦', 'мороженое'], ['🍫', 'шоколад сладкое'], ['🍺', 'пиво бар'], ['🍷', 'вино'], ['🍽', 'ресторан'],
  ['🚌', 'автобус транспорт'], ['🚕', 'такси'], ['🚗', 'машина авто'], ['⛽', 'бензин заправка'], ['🚇', 'метро'], ['🚆', 'поезд'], ['✈️', 'самолёт отпуск'],
  ['🚲', 'велосипед'], ['🛴', 'самокат'], ['🏍', 'мотоцикл'], ['🧳', 'чемодан путешествие'], ['🏖', 'пляж отпуск'], ['⛰', 'горы'], ['🏕', 'поход'],
  ['🏠', 'дом жильё аренда'], ['🛋', 'мебель'], ['🛏', 'кровать сон'], ['🔑', 'ключи аренда'], ['🔧', 'ремонт'], ['🔨', 'стройка'], ['💡', 'свет электричество идея'],
  ['💧', 'вода'], ['🔥', 'газ отопление'], ['🧹', 'уборка'], ['🧺', 'стирка'], ['🧴', 'бытовая химия'], ['🧾', 'счета чек'],
  ['📱', 'телефон связь'], ['💻', 'ноутбук компьютер'], ['📺', 'телевизор'], ['🌐', 'интернет'], ['🎧', 'музыка наушники'], ['🎬', 'кино'], ['🎮', 'игры'],
  ['🎫', 'билеты'], ['🍿', 'попкорн развлечения'], ['🎵', 'музыка подписка'], ['☁️', 'облако'],
  ['💊', 'аптека лекарства'], ['🩺', 'врач'], ['🦷', 'стоматолог'], ['👓', 'очки'], ['🏋️', 'спорт зал'], ['🏃', 'бег'], ['🏊', 'плавание'], ['🧘', 'йога медитация'],
  ['⚽', 'футбол'], ['🚴', 'велосипед спорт'], ['💇', 'стрижка'], ['💅', 'маникюр красота'], ['🧖', 'спа уход'], ['🚭', 'не курить'], ['😴', 'сон'],
  ['👕', 'одежда'], ['👗', 'платье'], ['👟', 'обувь'], ['👜', 'сумка'], ['⌚', 'часы'], ['💍', 'украшения'], ['🕶', 'очки'],
  ['👶', 'дети'], ['🧸', 'игрушки'], ['🐶', 'собака питомец'], ['🐱', 'кошка питомец'], ['🎓', 'учёба образование'], ['📚', 'книги'], ['✏️', 'канцелярия'],
  ['🎨', 'хобби творчество'], ['📷', 'фото'], ['🎸', 'гитара'], ['🌱', 'растения сад'], ['💐', 'цветы'], ['🎁', 'подарки'], ['🎉', 'праздник'], ['🎂', 'день рождения'],
  ['❤️', 'семья любовь'], ['🤝', 'помощь благотворительность'], ['👥', 'друзья'],
  ['💼', 'работа зарплата'], ['🏢', 'офис'], ['💰', 'деньги доход'], ['💵', 'наличные доллары'], ['💳', 'карта банк'], ['🏦', 'банк'], ['🐷', 'копилка'],
  ['📈', 'инвестиции рост'], ['🪙', 'монеты крипта'], ['🛡', 'страховка'], ['📦', 'посылка доставка'], ['🎯', 'цель'], ['⭐', 'важное'], ['🚀', 'мечта'],
  ['📅', 'календарь дела'], ['⏰', 'будильник'], ['✅', 'готово'], ['🧩', 'другое'],
];

/** Эмодзи по слову: «кофе» → ☕. Пустой запрос — все. */
export function searchEmoji(query: string): string[] {
  const q = norm(query);
  return EMOJI.filter(([, words]) => !q || norm(words).split(' ').some((w) => w.startsWith(q))).map(([e]) => e);
}

/** Ключи значков — латинские имена; всё остальное — эмодзи. */
export function isEmoji(icon: string): boolean {
  return !/^[A-Za-z][A-Za-z0-9]*$/.test(icon);
}

/** Первый символ (графема) введённого текста — для поля «свой эмодзи»: «👨‍👩‍👧 семья» → «👨‍👩‍👧». */
export function firstGrapheme(text: string): string {
  const t = text.trim();
  if (!t) return '';
  const Seg = (Intl as { Segmenter?: new (l: string, o: { granularity: 'grapheme' }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) for (const { segment } of new Seg('ru', { granularity: 'grapheme' }).segment(t)) return segment;
  return [...t][0] ?? '';
}
