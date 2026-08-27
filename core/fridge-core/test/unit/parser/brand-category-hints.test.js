import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { categoryHintForBrand } from '../../../src/infrastructure/parser/brand-category-hints.js';

describe('categoryHintForBrand', () => {
  test('bilinen içecek/temizlik/kişisel bakım markaları kesin kategori döner', () => {
    assert.equal(categoryHintForBrand('Kızılay'), 'beverages');
    assert.equal(categoryHintForBrand('Fairy'), 'cleaning');
    assert.equal(categoryHintForBrand('Colgate'), 'personal_care');
  });

  test('bilinmeyen marka veya null null döner', () => {
    assert.equal(categoryHintForBrand('Sütaş'), null);
    assert.equal(categoryHintForBrand(null), null);
    assert.equal(categoryHintForBrand(undefined), null);
  });
});
