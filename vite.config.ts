/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// На GitHub Pages приложение живёт в подпапке /<repo>/ — путь задаётся в CI.
const base = process.env.BASE_PATH ?? '/';
const version = [process.env.npm_package_version ?? '0.0.0', process.env.GITHUB_SHA?.slice(0, 7)]
  .filter(Boolean)
  .join(' · ');

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Финансы и дела',
        short_name: 'Финансы',
        description: 'Личные финансы и дела, работает офлайн',
        lang: 'ru',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f6f8',
        theme_color: '#f4f6f8',
        icons: [
          { src: 'icons/icon-180.png', sizes: '180x180', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Первый SW сразу берёт открытую страницу: офлайн работает уже после первого визита.
        // Обновления ждут кнопки «Обновить» в плашке (UpdatePrompt).
        clientsClaim: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
