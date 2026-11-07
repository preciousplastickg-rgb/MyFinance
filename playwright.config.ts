import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  // CI (контейнер WebKit) заметно медленнее ноутбука: после жеста новая вкладка иногда появляется позже 5 с по умолчанию.
  expect: { timeout: 10_000 },
  use: { baseURL: 'http://localhost:4173' },
  projects: [{ name: 'iphone-13', use: { ...devices['iPhone 13'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
