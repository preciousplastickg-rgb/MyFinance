// Собирает src/ui/glyphs.gen.ts — значки Phosphor (https://phosphoricons.com, MIT) только в нужных начертаниях.
// Пакет @phosphor-icons/react кладёт в каждый значок все шесть начертаний (~3,5 КБ), а приложению нужны одно-два:
// duotone — «картинки» (категории, счета, цели, меню), bold — значки интерфейса, fill — флажок «важно».
// Запуск: npm run glyphs. Результат коммитится; список имён ниже — единственный источник, unit-тест сверяет его с каталогом.
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const defsDir = require.resolve('@phosphor-icons/react').replace(/index\.cjs\.js$/, 'defs/');
const { version } = require('@phosphor-icons/react/package.json');

/** Значки категорий, счетов, сфер, привычек и целей — duotone: контур и заливка 20 %, в цветном кружке выглядят объёмно. */
const PICTURES = [
  // еда и покупки
  'ShoppingCart', 'ShoppingBag', 'Basket', 'Storefront', 'Tote', 'Coffee', 'ForkKnife', 'Hamburger', 'Pizza', 'BowlFood', 'CookingPot',
  'Bread', 'Carrot', 'Avocado', 'OrangeSlice', 'Cherries', 'Egg', 'Fish', 'Cake', 'IceCream', 'Cookie', 'BeerStein', 'Wine', 'Martini',
  // транспорт и поездки
  'Bus', 'Taxi', 'Car', 'CarProfile', 'Jeep', 'GasPump', 'Garage', 'Train', 'Subway', 'Airplane', 'AirplaneTilt', 'Bicycle', 'Scooter',
  'Motorcycle', 'Van', 'Truck', 'Boat', 'MapPin', 'Suitcase', 'SuitcaseRolling', 'Tent', 'Globe',
  // дом и коммуналка
  'House', 'Couch', 'Armchair', 'Bed', 'Lamp', 'Door', 'Key', 'Wrench', 'Hammer', 'Toolbox', 'PaintRoller', 'Lightning', 'Drop', 'Flame',
  'Thermometer', 'Snowflake', 'Fan', 'Plug', 'WashingMachine', 'Broom', 'Shower', 'Bathtub', 'ToiletPaper', 'Receipt', 'Invoice',
  // связь и подписки
  'WifiHigh', 'DeviceMobile', 'Phone', 'DeviceTablet', 'Laptop', 'Desktop', 'Printer', 'Television', 'Repeat', 'Cloud', 'MusicNotes',
  'Headphones', 'FilmSlate', 'Ticket', 'GameController', 'Popcorn', 'Envelope',
  // здоровье, спорт, уход
  'Heartbeat', 'Pill', 'Stethoscope', 'FirstAidKit', 'Hospital', 'Syringe', 'Bandaids', 'Tooth', 'Eyeglasses', 'Barbell', 'PersonSimpleRun',
  'PersonSimpleBike', 'PersonSimpleSwim', 'PersonSimpleTaiChi', 'Waves', 'SoccerBall', 'Basketball', 'Volleyball', 'TennisBall', 'Medal',
  'Trophy', 'Footprints', 'Timer', 'Prohibit', 'Cigarette', 'Brain', 'Scissors', 'Sparkle', 'Sunglasses',
  // одежда и вещи
  'TShirt', 'Hoodie', 'Pants', 'Dress', 'Sneaker', 'Sock', 'Handbag', 'Watch', 'Diamond', 'Crown',
  // семья, питомцы, учёба, отдых
  'Baby', 'BabyCarriage', 'PawPrint', 'Dog', 'Cat', 'Bird', 'Horse', 'GraduationCap', 'Student', 'Chalkboard', 'BookOpen', 'Books',
  'Notebook', 'Certificate', 'Guitar', 'Microphone', 'Camera', 'Palette', 'PuzzlePiece', 'DiceFive', 'Mountains', 'Tree', 'TreePalm', 'Plant',
  'Leaf', 'Flower', 'FlowerTulip', 'Sun', 'Umbrella', 'Gift', 'Confetti', 'Balloon', 'Heart', 'HandHeart', 'Users', 'User', 'Smiley',
  // работа и деньги
  'Briefcase', 'Buildings', 'Handshake', 'Gavel', 'Scales', 'Calculator', 'Percent', 'HandCoins', 'TrendUp', 'ChartLineUp', 'Coins', 'Coin',
  'Wallet', 'Bank', 'Money', 'CreditCard', 'PiggyBank', 'Vault', 'CurrencyBtc', 'Shield', 'Lock', 'Package', 'Rocket', 'Target', 'Lightbulb',
  'Star', 'CalendarCheck', 'DotOutline', 'DotsThree', 'ArrowsLeftRight', 'Hourglass', 'Alarm', 'Bell', 'Infinity',
  // меню и шапки — тоже duotone
  'CalendarDots', 'ListChecks', 'ChartPieSlice', 'Gear', 'Moon', 'ShieldWarning', 'Smiley',
];

/** Значки интерфейса: стрелки, крестики, плюсы — bold, по толщине как прежние 2 px. */
const UI = [
  'ArrowRight', 'Check', 'CaretDown', 'CaretLeft', 'CaretRight', 'CaretUp', 'Backspace', 'DotsThree', 'DotsSixVertical', 'HandCoins',
  'ChatText', 'Minus', 'PencilSimple', 'PiggyBank', 'Plus', 'ArrowsClockwise', 'Repeat', 'MagnifyingGlass', 'X', 'Trash', 'CalendarBlank',
  'CalendarDots', 'Coins', 'CreditCard', 'Sparkle',
];

/** Залитые: флажок «важно», «выполнено». */
const FILLED = ['Flag', 'CheckCircle', 'Star'];

const weights = { duotone: [...new Set(PICTURES)], bold: [...new Set(UI)], fill: [...new Set(FILLED)] };

/** Элемент React → [тег, атрибуты]; у Phosphor внутри только path / circle / rect / line / polyline с атрибутами-строками. */
function shapes(element) {
  const kids = element.props.children;
  const list = (Array.isArray(kids) ? kids : [kids]).filter(Boolean);
  return list.map((el) => {
    const attrs = {};
    for (const [k, v] of Object.entries(el.props)) if (k !== 'children') attrs[k] = String(v);
    return [el.type, attrs];
  });
}

const out = {};
for (const [weight, names] of Object.entries(weights)) {
  out[weight] = {};
  for (const name of names) {
    const mod = await import(pathToFileURL(`${defsDir}${name}.es.js`).href);
    const map = mod.default;
    const el = map.get(weight);
    if (!el) throw new Error(`Нет начертания ${weight} у ${name}`);
    out[weight][name] = shapes(el);
  }
}

const body = Object.entries(out)
  .map(([weight, glyphs]) => {
    const rows = Object.entries(glyphs).map(([name, s]) => `  ${name}: ${JSON.stringify(s)},`);
    return `export const ${weight.toUpperCase()}: Readonly<Record<string, readonly GlyphShape[]>> = {\n${rows.join('\n')}\n};`;
  })
  .join('\n\n');

await writeFile(
  new URL('../src/ui/glyphs.gen.ts', import.meta.url),
  `// Сгенерировано scripts/gen-glyphs.mjs из @phosphor-icons/react ${version} (MIT) — не править руками: npm run glyphs.\n` +
    `/* eslint-disable */\n\n` +
    `/** Фигура значка: тег SVG и его атрибуты, viewBox 0 0 256 256. */\n` +
    `export type GlyphShape = readonly [tag: string, attrs: Readonly<Record<string, string>>];\n\n` +
    body +
    '\n',
);
console.log(`glyphs ok: duotone ${weights.duotone.length}, bold ${weights.bold.length}, fill ${weights.fill.length}`);
