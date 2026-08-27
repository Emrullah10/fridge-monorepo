import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { isUncertainProductName } from '../../../src/domain/name-confidence.js';

describe('isUncertainProductName', () => {
  test('bitişik/kesik OCR isimleri true döner — asıl regresyon kilidi', () => {
    assert.equal(isUncertainProductName('MANGOANA', { productSource: 'ai_generated' }), true);
    assert.equal(isUncertainProductName('KIZILAYMANGOANA', { productSource: 'ai_generated' }), true);
  });

  test('kısa/gerçek tek kelimelik ürün adları false döner — yanlış pozitif olmamalı', () => {
    assert.equal(isUncertainProductName('Domates', { productSource: 'ai_generated' }), false);
    assert.equal(isUncertainProductName('Süt', { productSource: 'ai_generated' }), false);
    assert.equal(isUncertainProductName('Soğan', { productSource: 'ai_generated' }), false);
  });

  test('çok kelimeli isimler false döner', () => {
    assert.equal(isUncertainProductName('Tam Buğday Ekmeği', { productSource: 'ai_generated' }), false);
    assert.equal(isUncertainProductName('Kızılay Mango Ananas Maden Suyu', { productSource: 'ai_generated' }), false);
  });

  test('kullanıcı/seed kaynaklı ürünler muaf — kontrol edilmez', () => {
    assert.equal(isUncertainProductName('MANGOANA', { productSource: 'user' }), false);
    assert.equal(isUncertainProductName('MANGOANA', { productSource: 'seed' }), false);
  });

  test('kaynak belirtilmezse (productSource undefined) yine de kontrol edilir', () => {
    assert.equal(isUncertainProductName('MANGOANA'), true);
  });

  test('çok kısa isimler true döner', () => {
    assert.equal(isUncertainProductName('X', { productSource: 'ai_generated' }), true);
    assert.equal(isUncertainProductName('', { productSource: 'ai_generated' }), false);
  });

  test('marka öneki sıyrılıp gövde kontrol edilir — asıl regresyon kilidi (Kızılay Mangoana)', () => {
    // Bugüne kadar bu isim FALSE dönüyordu: buildFinalName markayı başa
    // ekleyince "Mangoana" (tek kelime, şüpheli) "Kızılay Mangoana" (iki
    // kelime, "temiz görünen") olup kontrolden kaçıyordu.
    assert.equal(isUncertainProductName('Kızılay Mangoana', { productSource: 'ai_generated', brand: 'Kızılay' }), true);
  });

  test('marka sıyrılınca kalan gövde de çok kelimeliyse yanlış pozitif olmaz', () => {
    assert.equal(isUncertainProductName('Kızılay Mango Ananas Maden Suyu', { productSource: 'ai_generated', brand: 'Kızılay' }), false);
  });

  test('marka sıyrılınca kalan gövde kısa/gerçek kelimeyse yanlış pozitif olmaz', () => {
    assert.equal(isUncertainProductName('Kızılay Soda', { productSource: 'ai_generated', brand: 'Kızılay' }), false);
  });

  test('brand parametresi verilmezse eski davranış korunur (geriye dönük uyumluluk)', () => {
    assert.equal(isUncertainProductName('Kızılay Mangoana', { productSource: 'ai_generated' }), false);
  });
});
