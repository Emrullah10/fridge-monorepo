import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { suggestStorageKind } from '../../../src/domain/storage-suggestion.js';

describe('suggestStorageKind', () => {
  test('kategoriden çözer — kesin sinyal, anahtar kelimeye bakmadan karar verir', () => {
    assert.equal(suggestStorageKind({ categoryKey: 'dairy.yogurt', productName: 'Yoğurt' }), 'fridge');
    assert.equal(suggestStorageKind({ categoryKey: 'frozen', productName: 'Dondurma' }), 'freezer');
    assert.equal(suggestStorageKind({ categoryKey: 'cleaning', productName: 'Deterjan' }), 'pantry');
  });

  test('kategori "other" veya yoksa anahtar kelime yedeğine düşer', () => {
    assert.equal(suggestStorageKind({ categoryKey: 'other', productName: "Yumurta (15'li)" }), 'fridge');
    assert.equal(suggestStorageKind({ categoryKey: null, productName: 'Dondurma' }), 'freezer');
    assert.equal(suggestStorageKind({ categoryKey: null, productName: 'Deterjan' }), 'pantry');
  });

  test('kategori de anahtar kelime de tanımıyorsa null döner — kullanıcı seçmeli (regresyon kilidi)', () => {
    assert.equal(suggestStorageKind({ categoryKey: 'other', productName: 'Tamamen Bilinmeyen Şey' }), null);
    assert.equal(suggestStorageKind({ categoryKey: null, productName: 'xyz123' }), null);
  });

  test('kategori anahtar kelimeyi ezer (öncelik sırası doğru)', () => {
    // "dondurma" kelimesi geçse bile kategori 'dairy' ise fridge kazanmalı —
    // kategori daha güvenilir bir sinyal (kullanıcı/AI onaylı), keyword yedek.
    assert.equal(suggestStorageKind({ categoryKey: 'dairy', productName: 'Dondurma Sosu' }), 'fridge');
  });

  test('anahtar kelime sırası önemli: "dondurma" genel süt kelimelerinden önce kontrol edilir', () => {
    assert.equal(suggestStorageKind({ categoryKey: null, productName: 'Dondurulmuş Süt' }), 'freezer');
  });

  test('Türkçe ünsüz yumuşamalı çekim halleri de yakalanır — regresyon kilidi', () => {
    // Gerçek gözlem: "Meyve Yoğurdu" (t->d yumuşaması) yakalanamıyordu.
    assert.equal(suggestStorageKind({ categoryKey: null, productName: 'Meyve Yoğurdu' }), 'fridge');
    assert.equal(suggestStorageKind({ categoryKey: null, productName: 'Kaymağı' }), 'fridge');
  });
});
