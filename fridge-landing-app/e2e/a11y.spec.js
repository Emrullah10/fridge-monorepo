import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('erişilebilirlik (WCAG AA)', () => {
  test('ana sayfa — açık tema', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations).toEqual([]);
  });

  test('/ekranlar — açık tema', async ({ page }) => {
    await page.goto('/ekranlar');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations).toEqual([]);
  });

  test('/ekranlar — koyu tema', async ({ page }) => {
    await page.goto('/ekranlar');
    await page.click('[data-theme-choice="dark"]');
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
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
