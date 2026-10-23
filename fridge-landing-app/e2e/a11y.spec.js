import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Sürmekte olan geçiş/animasyon varken axe yarı saydam rengi ölçüp sahte kontrast hatası verir.
async function settle(page) {
  await page.waitForFunction(() => document.getAnimations().length === 0, null, { timeout: 5000 });
}

test.describe('erişilebilirlik (WCAG AA)', () => {
  // .reveal beliriş animasyonu sürerken axe yarı saydam rengi ölçüyordu; nihai durum test edilir.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('ana sayfa — açık tema', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations).toEqual([]);
  });

  test('/ekranlar — açık tema', async ({ page }) => {
    await page.goto('/ekranlar');
    await settle(page);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations).toEqual([]);
  });

  test('/ekranlar — koyu tema', async ({ page }) => {
    await page.goto('/ekranlar');
    await page.click('[data-theme-choice="dark"]');
    await settle(page);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations).toEqual([]);
  });

  const contentPages = [
    '/ozellikler',
    '/ozellikler/fis-tarama',
    '/nasil-calisir',
    '/metrikler',
    '/sss',
    '/indir',
    '/basin',
    '/gizlilik',
    '/kvkk',
    '/sartlar',
    '/veri-silme',
  ];
  for (const path of contentPages) {
    test(`${path}`, async ({ page }) => {
      await page.goto(path);
      await settle(page);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
