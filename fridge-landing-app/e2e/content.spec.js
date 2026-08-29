import { test, expect } from '@playwright/test';
import { marketing } from '../src/i18n/marketing.tr.js';

// marketing.tr.js import edilip home.acts başlıklarının sayfada olduğu
// doğrulanır (screens.spec.js'in screens.js için kullandığı desenin aynısı).
test.describe('ana sayfa i18n içeriği', () => {
  test('home.acts başlıkları sayfada görünür', async ({ page }) => {
    await page.goto('/');
    for (const act of marketing.home.acts) {
      await expect(page.getByText(act.title, { exact: true })).toBeVisible();
    }
  });

  test('hero titleLines satırları sayfada görünür', async ({ page }) => {
    await page.goto('/');
    for (const line of marketing.home.hero.titleLines) {
      await expect(page.locator('[data-line]', { hasText: line })).toBeVisible();
    }
  });

  test('home.features başlıkları sayfada görünür', async ({ page }) => {
    await page.goto('/');
    for (const feature of marketing.home.features) {
      await expect(page.getByText(feature.title, { exact: true }).first()).toBeVisible();
    }
  });

  test('finalCta başlığı sayfada görünür', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(marketing.home.finalCta.title, { exact: true })).toBeVisible();
  });
});
