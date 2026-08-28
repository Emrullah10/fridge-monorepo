import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4321',
  },
  webServer: {
    // `astro preview` VE `astro dev` bu Astro sürümünde varsayılan olarak
    // arka plana geçip hemen çıkıyor (exit 0) — Playwright'in webServer'ı
    // bunu "çöktü" sanıp "Process from config.webServer exited early" hatası
    // veriyor (bkz. cerebrum.md Do-Not-Repeat). scripts/static-serve.mjs
    // foreground kalan minimal bir statik sunucu; build önce ayrı çalıştırılır.
    command: 'npm run build && node scripts/static-serve.mjs',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
