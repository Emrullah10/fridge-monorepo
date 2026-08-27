import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { matchRecipeIngredients, summarizeMatch } from '../../../src/domain/ingredient-match.js';

describe('matchRecipeIngredients', () => {
  test('yeterli stok varsa available döner', () => {
    const ingredients = [{ productId: 'p1', quantity: 2, unit: 'piece', isOptional: false }];
    const inventory = [{ productId: 'p1', unit: 'piece', quantity: 5 }];
    const result = matchRecipeIngredients(ingredients, inventory);
    assert.equal(result[0].matchStatus, 'available');
  });

  test('bir ürünün birden fazla envanter satırı toplanır — regresyon kilidi (eski SQL JOIN çoğalması hatası)', () => {
    // Eskiden SQL'de COUNT(ri.id) - COUNT(inv.id) kullanılıyordu; bir ürünün
    // 3 envanter satırı varken 2 malzemeli bir tarifte missing_count = 2-4 = -2
    // gibi negatif bir sayı üretiyordu. Burada aynı senaryo: tek malzeme,
    // ürünün 3 ayrı lokasyon/SKT satırı var — toplam miktar doğru hesaplanmalı.
    const ingredients = [{ productId: 'p1', quantity: 4, unit: 'gram', isOptional: false }];
    const inventory = [
      { productId: 'p1', unit: 'gram', quantity: 1 },
      { productId: 'p1', unit: 'gram', quantity: 1 },
      { productId: 'p1', unit: 'gram', quantity: 1 },
    ];
    const result = matchRecipeIngredients(ingredients, inventory);
    assert.equal(result[0].availableQuantity, 3);
    assert.equal(result[0].matchStatus, 'partial');

    const summary = summarizeMatch(result);
    assert.equal(summary.missingCount, 1);
    assert.ok(summary.missingCount >= 0, 'missingCount asla negatif olamaz');
  });

  test('miktar yetersizse partial döner, yok sayılmaz ama var da sayılmaz', () => {
    const ingredients = [{ productId: 'p1', quantity: 500, unit: 'gram', isOptional: false }];
    const inventory = [{ productId: 'p1', unit: 'gram', quantity: 1 }];
    const result = matchRecipeIngredients(ingredients, inventory);
    assert.equal(result[0].matchStatus, 'partial');
  });

  test('birim uyuşmazlığında dönüşüm yapmadan unit_mismatch döner', () => {
    const ingredients = [{ productId: 'p1', quantity: 1, unit: 'gram', isOptional: false }];
    const inventory = [{ productId: 'p1', unit: 'kilogram', quantity: 5 }];
    const result = matchRecipeIngredients(ingredients, inventory);
    assert.equal(result[0].matchStatus, 'unit_mismatch');
  });

  test('envanterde hiç yoksa missing döner', () => {
    const ingredients = [{ productId: 'p1', quantity: 1, unit: 'piece', isOptional: false }];
    const result = matchRecipeIngredients(ingredients, []);
    assert.equal(result[0].matchStatus, 'missing');
  });

  test('productId null olan malzeme (tarif AI\'ının customName ile kaydettiği) her zaman missing döner, çökmez', () => {
    // generate-ai-recipes.use-case.js artık eşleşmeyen malzeme için yeni
    // product yaratmıyor — productId null, customName ile saklanıyor. Bu
    // malzemenin envanterde asla karşılığı olamaz.
    const ingredients = [{ productId: null, customName: 'Bilinmeyen Malzeme', quantity: 1, unit: 'piece', isOptional: false }];
    const inventory = [{ productId: 'p1', unit: 'piece', quantity: 5 }];
    const result = matchRecipeIngredients(ingredients, inventory);
    assert.equal(result[0].matchStatus, 'missing');
  });
});

describe('summarizeMatch', () => {
  test('opsiyonel malzemeler eksik olsa da missingCount\'a girmez', () => {
    const matched = [
      { isOptional: false, matchStatus: 'available' },
      { isOptional: true, matchStatus: 'missing' },
    ];
    const summary = summarizeMatch(matched);
    assert.equal(summary.totalIngredients, 1);
    assert.equal(summary.missingCount, 0);
  });

  test('zorunlu ve eksik malzemeler sayılır', () => {
    const matched = [
      { isOptional: false, matchStatus: 'available' },
      { isOptional: false, matchStatus: 'missing' },
      { isOptional: false, matchStatus: 'unit_mismatch' },
    ];
    const summary = summarizeMatch(matched);
    assert.equal(summary.totalIngredients, 3);
    assert.equal(summary.availableIngredients, 1);
    assert.equal(summary.missingCount, 2);
  });
});
