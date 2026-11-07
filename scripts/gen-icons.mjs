// Рендерит scripts/icon.svg в PNG-иконки PWA через Playwright (Chromium).
// Запуск: npm run icons. Результат коммитится в public/icons.
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const svg = await readFile(new URL('./icon.svg', import.meta.url), 'utf8');
const out = new URL('../public/icons/', import.meta.url);
const browser = await chromium.launch();

for (const size of [180, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: new URL(`icon-${size}.png`, out).pathname });
  await page.close();
}
await browser.close();

await copyFile(new URL('icon-180.png', out), new URL('apple-touch-icon.png', out));
// Фавикон со скруглением — для вкладки браузера: весь рисунок (фон, блик, тень) обрезается по скруглённому квадрату.
await writeFile(
  new URL('favicon.svg', out),
  svg
    .replace(/(<svg[^>]*>)/, '$1\n  <clipPath id="round"><rect width="512" height="512" rx="112"/></clipPath>\n  <g clip-path="url(#round)">')
    .replace('</svg>', '  </g>\n</svg>'),
);
console.log('icons ok');
