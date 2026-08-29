import { test, expect } from '@playwright/test';

// "Azaltılmış hareket hâlâ gerçek bir deneyim" iddiasını temenni olmaktan
// çıkarıp zorunlu kılan test (bkz. plan "Yeni testler").
test.describe('hareket katmanları', () => {
  test('reducedMotion: reduce -> html[data-motion="still"]', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const tier = await page.evaluate(() => document.documentElement.getAttribute('data-motion'));
    expect(tier).toBe('still');
  });

  test('still katmaninda GSAP parcasi hic istenmiyor', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const requestedUrls = [];
    page.on('request', (req) => requestedUrls.push(req.url()));
    await page.goto('/');
    await page.waitForTimeout(500); // dinamik import'un tetiklenmesi için pencere
    const gsapRequested = requestedUrls.some((u) => /\/home(\.[\w-]+)?\.js|gsap/i.test(u));
    expect(gsapRequested).toBe(false);
  });

  test('still katmaninda hero baslik satirlari DOMda goruntulenir', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const lines = page.locator('[data-line]');
    await expect(lines).toHaveCount(3);
    for (const line of await lines.all()) {
      await expect(line).toBeVisible();
    }
  });

  test('full katmaninda GSAP home parcasi indirilir', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const requestedUrls = [];
    page.on('request', (req) => requestedUrls.push(req.url()));
    await page.goto('/');
    await page.waitForTimeout(500);
    const gsapRequested = requestedUrls.some((u) => /\/home(\.[\w-]+)?\.js|gsap/i.test(u));
    expect(gsapRequested).toBe(true);
  });
});
