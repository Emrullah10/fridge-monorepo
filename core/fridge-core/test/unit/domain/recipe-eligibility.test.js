import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { classifyForRecipe } from '../../../src/domain/recipe-eligibility.js';

describe('classifyForRecipe', () => {
  test('cleaning ve personal_care elenir', () => {
    assert.equal(classifyForRecipe({ categoryId: 'cleaning' }), 'excluded');
    assert.equal(classifyForRecipe({ categoryId: 'personal_care' }), 'excluded');
  });

  test('beverages ayrı kovaya düşer, elenmez', () => {
    assert.equal(classifyForRecipe({ categoryId: 'beverages' }), 'beverage');
  });

  test('null kategori ingredient kovasına düşer, elenmez', () => {
    assert.equal(classifyForRecipe({ categoryId: null }), 'ingredient');
    assert.equal(classifyForRecipe({}), 'ingredient');
  });

  test('normal gıda kategorileri ingredient kovasına düşer', () => {
    assert.equal(classifyForRecipe({ categoryId: 'dairy.milk' }), 'ingredient');
    assert.equal(classifyForRecipe({ categoryId: 'produce' }), 'ingredient');
    assert.equal(classifyForRecipe({ categoryId: 'meat' }), 'ingredient');
  });
});
