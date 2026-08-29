import { test, expect } from '@playwright/test';
import { screens } from '../src/lib/screens.js';

test.describe('/ekranlar galerisi', () => {
  test('sayfa açılır ve tüm ekran başlıkları görünür', async ({ page }) => {
    await page.goto('/ekranlar');
    await expect(page.locator('h1')).toHaveText('Ekranlar');
    for (const s of screens) {
      await expect(page.locator(`[data-screen-key="${s.key}"]`)).toBeVisible();
    }
  });

  test('dolu/boş anahtarı empty-destekli ekranları değiştirir', async ({ page }) => {
    await page.goto('/ekranlar');
    const slot = page.locator('[data-screen-key="inventory"]');
    await expect(slot.locator('[data-mode="full"][data-theme-choice="light"]')).toBeVisible();
    await page.click('[data-mode="empty"]');
    await expect(slot.locator('[data-mode="empty"][data-theme-choice="light"]')).toBeVisible();
  });

  test('açık/koyu tema anahtarı çalışır', async ({ page }) => {
    await page.goto('/ekranlar');
    const slot = page.locator('[data-screen-key="welcome"]');
    await expect(slot.locator('[data-mode="full"][data-theme-choice="light"]')).toBeVisible();
    await page.click('[data-theme-choice="dark"]');
    await expect(slot.locator('[data-mode="full"][data-theme-choice="dark"]')).toBeVisible();
  });

  test('sayfa yatay scroll üretmiyor', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/ekranlar');
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalScroll).toBe(false);
  });
});

test.describe('ana sayfa', () => {
  test('yüklenir ve hero metni görünür', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });

  for (const width of [320, 375]) {
    test(`${width}px'te yatay scroll üretmiyor`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHorizontalScroll).toBe(false);
    });
  }
});
