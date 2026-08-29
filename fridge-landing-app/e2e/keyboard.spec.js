import { test, expect } from '@playwright/test';

// ScrollSmoother #smooth-content'i transform ile ötelediğinde ekran dışı bir
// öğeye Tab'lamak wrapper'ı kaydıramaz ve odaklı öğe görünmez kalabilir —
// 2.4.7/2.4.3 ihlali, axe bunu YAKALAMAZ (bkz. plan "Odak yönetimi gerçek bir
// WCAG riski"). Bu test her odaklı öğenin viewport içinde kaldığını doğrular.
test.describe('klavye ile gezinme — odak görünürlüğü', () => {
  test('/ boyunca Tab ile gezinme her adımda odaklı öğeyi viewport içinde tutar', async ({ page }) => {
    await page.goto('/');
    // full katman zorlanır: masaüstü viewport + reducedMotion olmadan varsayılan.
    await page.setViewportSize({ width: 1280, height: 800 });

    const maxTabs = 20;
    for (let i = 0; i < maxTabs; i++) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      const count = await focused.count();
      if (count === 0) continue;
      const box = await focused.first().boundingBox();
      if (!box) continue; // display:none vb. — odaklanamaz zaten
      expect(box.y + box.height).toBeGreaterThan(-1);
      expect(box.y).toBeLessThan(800 + 1);
    }
  });
});
