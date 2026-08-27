import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { toBaseAmount, computeRecipeNutrition, mergeDietConstraints } from '../../../src/domain/nutrition.js';

describe('nutrition — toBaseAmount', () => {
  test('gram/kilogram gram bazına çevrilir', () => {
    assert.equal(toBaseAmount(2, 'kilogram', '100g'), 2000);
    assert.equal(toBaseAmount(250, 'gram', '100g'), 250);
  });
  test('milliliter/liter ml bazına çevrilir', () => {
    assert.equal(toBaseAmount(1, 'liter', '100ml'), 1000);
  });
  test('piece/package deterministik çevrilemez -> null', () => {
    assert.equal(toBaseAmount(3, 'piece', '100g'), null);
    assert.equal(toBaseAmount(1, 'package', '100ml'), null);
  });
});

describe('nutrition — computeRecipeNutrition', () => {
  test('besin verisi olan malzemeler porsiyona bölünerek toplanır', () => {
    const ingredients = [
      // 200g un: 100g=350kcal -> 700kcal
      { quantity: 200, unit: 'gram', nutrition: { kcal: 350, protein: 10, carb: 72, fat: 1, basis: '100g' } },
      // 500ml süt: 100ml=64kcal -> 320kcal
      { quantity: 500, unit: 'milliliter', nutrition: { kcal: 64, protein: 3.4, carb: 4.8, fat: 3.6, basis: '100ml' } },
    ];
    const result = computeRecipeNutrition(ingredients, 2);

    assert.equal(result.perServing.kcal, Math.round((700 + 320) / 2)); // 510
    assert.equal(result.countedIngredients, 2);
    assert.equal(result.skippedIngredients, 0);
    assert.equal(result.complete, true);
  });

  test('besin verisi olmayan veya birim çevrilemeyen malzeme atlanır, complete=false', () => {
    const ingredients = [
      { quantity: 100, unit: 'gram', nutrition: { kcal: 200, basis: '100g' } },
      { quantity: 2, unit: 'piece', nutrition: { kcal: 80, basis: '100g' } }, // çevrilemez
      { quantity: 50, unit: 'gram', nutrition: null }, // veri yok
    ];
    const result = computeRecipeNutrition(ingredients, 1);

    assert.equal(result.perServing.kcal, 200);
    assert.equal(result.countedIngredients, 1);
    assert.equal(result.skippedIngredients, 2);
    assert.equal(result.complete, false);
  });

  test('servings 0/null ise bölünmez', () => {
    const ingredients = [{ quantity: 100, unit: 'gram', nutrition: { kcal: 100, basis: '100g' } }];
    assert.equal(computeRecipeNutrition(ingredients, 0).perServing.kcal, 100);
    assert.equal(computeRecipeNutrition(ingredients, null).perServing.kcal, 100);
  });
});

describe('nutrition — mergeDietConstraints', () => {
  test('alerjenler birleştirilir (küçük harf, tekilleştirilmiş), none diyet atlanır', () => {
    const merged = mergeDietConstraints([
      { allergens: ['Fındık', 'Süt'], diet: 'vegetarian' },
      { allergens: ['fındık'], diet: 'none' },
      { allergens: [], diet: 'vegan' },
      null,
    ]);
    assert.deepEqual(merged.allergens.sort(), ['fındık', 'süt']);
    assert.deepEqual(merged.diets.sort(), ['vegan', 'vegetarian']);
  });
});
