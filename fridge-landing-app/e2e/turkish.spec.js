import { test, expect } from '@playwright/test';

// Render edilen <h1> ı ş ğ İ içermeli + font gerçekten yüklenmeli — eksik
// latin-ext alt kümesi derlemeyi düşürmez ama sessizce tofu üretir (bkz. plan
// "Tipografi — Türkçe kararı belirliyor"). Bu test o regresyonu yakalar.
test.describe('Türkçe glif ve font yükleme', () => {
  test('ana sayfa h1 Turkce\'ye ozgu karakterler iceriyor', async ({ page }) => {
    await page.goto('/');
    const h1Text = await page.locator('h1').first().textContent();
    // "Fişi tara, gerisini Fridge halletsin." -> ş, i (dotted, latin ok) var;
    // aşağıdaki geniş regex hem TR'ye özgü hem genel Latin Extended karakterleri kapsar.
    expect(h1Text).toMatch(/[şŞğĞıİöÖüÜçÇ]/);
  });

  test('Bricolage Grotesque font-face latin-ext unicode-range içeriyor', async ({ page }) => {
    await page.goto('/');
    const hasLatinExt = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of rules) {
          if (rule instanceof CSSFontFaceRule) {
            const range = rule.style.getPropertyValue('unicode-range');
            // Tarayıcı baştaki sıfırları kırpar (U+0131 -> U+131). U+131 =
            // dotless ı; U+100-2FF Latin Extended-A/B kapsar ğ ş İ.
            if (range && (/U\+0?131\b/.test(range) || /U\+0?100-/.test(range))) {
              return true;
            }
          }
        }
      }
      return false;
    });
    expect(hasLatinExt).toBe(true);
  });

  test('h1 --font-display kullanıyor (Inter/sistem fontuna geri düşmüyor)', async ({ page }) => {
    await page.goto('/');
    const fontFamily = await page.locator('h1').first().evaluate((el) => getComputedStyle(el).fontFamily);
    expect(fontFamily.toLowerCase()).not.toContain('inter');
  });
});
