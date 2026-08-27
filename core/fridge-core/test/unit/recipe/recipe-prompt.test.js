import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildUserPrompt } from '../../../src/infrastructure/recipe/recipe-prompt.js';

describe('buildUserPrompt', () => {
  test('marka satıra girer, kategori köşeli parantezde gösterilir', () => {
    const prompt = buildUserPrompt({
      ingredients: [{ name: 'Süt', brand: 'Sütaş', categoryId: 'dairy.milk', quantity: 1, unit: 'liter' }],
      beverages: [],
    });
    assert.match(prompt, /Sütaş — Süt: 1 liter \[dairy\.milk\]/);
  });

  test('kategori bilinmiyorsa açıkça işaretlenir', () => {
    const prompt = buildUserPrompt({
      ingredients: [{ name: 'Domates', categoryId: null, quantity: 500, unit: 'gram' }],
      beverages: [],
    });
    assert.match(prompt, /Domates: 500 gram \[kategori bilinmiyor\]/);
  });

  test('isUncertain "?" işareti üretir', () => {
    const prompt = buildUserPrompt({
      ingredients: [
        { name: 'Kizilay Mangoana', categoryId: null, quantity: 6, unit: 'piece', isUncertain: true },
      ],
      beverages: [],
    });
    assert.match(prompt, /Kizilay Mangoana: 6 piece \[kategori bilinmiyor\] \?$/m);
  });

  test('beverages ayrı bir blokta gösterilir, ana malzeme listesine karışmaz', () => {
    const prompt = buildUserPrompt({
      ingredients: [{ name: 'Domates', categoryId: 'produce', quantity: 1, unit: 'kilogram' }],
      beverages: [{ name: 'Maden Suyu', brand: 'Kızılay Mango Ananas', categoryId: 'beverages', quantity: 6, unit: 'piece' }],
    });
    const beverageSectionIndex = prompt.indexOf('İçecekler');
    const beverageLineIndex = prompt.indexOf('Maden Suyu');
    assert.ok(beverageSectionIndex !== -1, 'İçecekler başlığı olmalı');
    assert.ok(beverageLineIndex > beverageSectionIndex, 'İçecek satırı başlıktan sonra gelmeli');
    // Ana malzeme bloğunda içecek geçmemeli — beverages bölümünden önceki
    // kısımda "Maden Suyu" aranmamalı.
    assert.ok(!prompt.slice(0, beverageSectionIndex).includes('Maden Suyu'));
  });

  test('beverages boşsa İçecekler başlığı hiç görünmez', () => {
    const prompt = buildUserPrompt({
      ingredients: [{ name: 'Domates', categoryId: 'produce', quantity: 1, unit: 'kilogram' }],
      beverages: [],
    });
    assert.ok(!prompt.includes('İçecekler'));
  });

  test('cleaning kategorisi hiç görünmez — çağıran taraf zaten filtrelemiş olmalı, ama satır kurucu marka/kategori formatını bozmamalı', () => {
    // classifyForRecipe zaten cleaning'i eler; bu test sadece buildUserPrompt'a
    // hiçbir 'cleaning' etiketli kalem VERİLMEDİĞİNDE çıktının temiz kaldığını
    // doğruluyor (entegrasyon noktası generate-ai-recipes.use-case.js'de).
    const prompt = buildUserPrompt({
      ingredients: [{ name: 'Domates', categoryId: 'produce', quantity: 1, unit: 'kilogram' }],
      beverages: [],
    });
    assert.ok(!prompt.includes('cleaning'));
  });

  test('SKT yakın bayrağı korunur', () => {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const prompt = buildUserPrompt({
      ingredients: [{ name: 'Yoğurt', categoryId: 'dairy.yogurt', quantity: 1, unit: 'kilogram', expiresAt: soon }],
      beverages: [],
    });
    assert.match(prompt, /\(SKT yakın\)/);
  });
});
