import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildRhythmUserPrompt, buildTextUserPrompt } from '../../../src/infrastructure/shopping/shopping-prompt.js';

describe('buildRhythmUserPrompt', () => {
  test('istatistik satır formatı: marka, kategori, elde/tüketim/ortalama/son tüketim', () => {
    const prompt = buildRhythmUserPrompt({
      profile: [{
        name: 'Süt', brand: 'Sütaş', categoryId: 'dairy.milk', unit: 'liter',
        onHand: 0, totalConsumed: 8, eventCount: 8, avgIntervalDays: 12.3, daysSinceLast: 15.7,
      }],
    });
    assert.match(prompt, /Sütaş Süt \[dairy\.milk\]: elde 0 liter/);
    assert.match(prompt, /son 120 günde 8 kez toplam 8 liter/);
    assert.match(prompt, /ortalama 12 günde bir/);
    assert.match(prompt, /son tüketim 16 gün önce/);
  });

  test('avgIntervalDays null ise ortalama kısmı hiç görünmez', () => {
    const prompt = buildRhythmUserPrompt({
      profile: [{
        name: 'Domates', brand: null, categoryId: null, unit: 'kilogram',
        onHand: 0, totalConsumed: 2, eventCount: 2, avgIntervalDays: null, daysSinceLast: 5,
      }],
    });
    assert.ok(!prompt.includes('ortalama'));
  });
});

describe('buildTextUserPrompt', () => {
  test('kullanıcı isteği ve mevcut envanter özeti dahil edilir', () => {
    const prompt = buildTextUserPrompt({
      text: 'bu hafta 4 kişilik kahvaltılık lazım',
      inventorySummary: [{ name: 'Süt' }, { name: 'Yumurta' }],
    });
    assert.match(prompt, /İstek: bu hafta 4 kişilik kahvaltılık lazım/);
    assert.match(prompt, /Dolapta zaten var:/);
    assert.match(prompt, /- Süt/);
    assert.match(prompt, /- Yumurta/);
  });

  test('envanter boşsa "Dolapta zaten var" bölümü hiç görünmez', () => {
    const prompt = buildTextUserPrompt({ text: 'ekmek al', inventorySummary: [] });
    assert.ok(!prompt.includes('Dolapta zaten var'));
  });
});
