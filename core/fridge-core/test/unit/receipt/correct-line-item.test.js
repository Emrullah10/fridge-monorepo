import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeCorrectLineItem } from '../../../src/application/use-cases/receipt/correct-line-item.use-case.js';

const makeFakes = ({ products = new Map() } = {}) => {
  const lineItemUpdates = [];
  const aliasesUpserted = [];
  const brandUpdates = [];
  const nameUpdates = [];

  const receiptLineItemRepo = {
    update: async (id, data) => {
      const updated = { id, rawText: 'RAW TEXT', ...data };
      lineItemUpdates.push(updated);
      return updated;
    },
  };

  const productAliasRepo = {
    upsertUserCorrection: async (input) => {
      aliasesUpserted.push(input);
      return input;
    },
  };

  const productRepo = {
    findById: async (id) => products.get(id),
    updateBrand: async (id, brand) => {
      brandUpdates.push({ id, brand });
      return { ...products.get(id), brand };
    },
    updateCanonicalName: async (id, canonicalName) => {
      nameUpdates.push({ id, canonicalName });
      return { ...products.get(id), canonicalName };
    },
  };

  return { receiptLineItemRepo, productAliasRepo, productRepo, nameUpdates, brandUpdates, aliasesUpserted };
};

describe('makeCorrectLineItem', () => {
  test('ai_generated ürün için yeni isim product.canonicalName\'e yazılır', async () => {
    const products = new Map([['product-1', { id: 'product-1', source: 'ai_generated', canonicalName: 'Eski Yanlış İsim' }]]);
    const fakes = makeFakes({ products });
    const correctLineItem = makeCorrectLineItem(fakes);

    await correctLineItem({
      lineItemId: 'line-1',
      householdId: 'hh-1',
      parsedName: 'Doğru İsim',
      parsedBrand: undefined,
      parsedQuantity: 1,
      parsedUnit: 'piece',
      matchedProductId: 'product-1',
    });

    assert.deepEqual(fakes.nameUpdates, [{ id: 'product-1', canonicalName: 'Doğru İsim' }]);
  });

  test('katalog (ai_generated olmayan) ürün için isim güncellenmez', async () => {
    const products = new Map([['product-1', { id: 'product-1', source: 'user', canonicalName: 'Katalog İsmi' }]]);
    const fakes = makeFakes({ products });
    const correctLineItem = makeCorrectLineItem(fakes);

    await correctLineItem({
      lineItemId: 'line-1',
      householdId: 'hh-1',
      parsedName: 'Yeni İsim',
      parsedBrand: undefined,
      parsedQuantity: 1,
      parsedUnit: 'piece',
      matchedProductId: 'product-1',
    });

    assert.deepEqual(fakes.nameUpdates, []);
  });

  test('parsedName boş/undefined ise isim güncellenmez', async () => {
    const products = new Map([['product-1', { id: 'product-1', source: 'ai_generated', canonicalName: 'Eski İsim' }]]);
    const fakes = makeFakes({ products });
    const correctLineItem = makeCorrectLineItem(fakes);

    await correctLineItem({
      lineItemId: 'line-1',
      householdId: 'hh-1',
      parsedName: '   ',
      parsedBrand: undefined,
      parsedQuantity: 1,
      parsedUnit: 'piece',
      matchedProductId: 'product-1',
    });

    assert.deepEqual(fakes.nameUpdates, []);
  });

  test('matchedProductId yoksa hiçbir repo yazılmaz', async () => {
    const fakes = makeFakes();
    const correctLineItem = makeCorrectLineItem(fakes);

    await correctLineItem({
      lineItemId: 'line-1',
      householdId: 'hh-1',
      parsedName: 'İsim',
      parsedBrand: undefined,
      parsedQuantity: 1,
      parsedUnit: 'piece',
      matchedProductId: null,
    });

    assert.deepEqual(fakes.nameUpdates, []);
    assert.deepEqual(fakes.aliasesUpserted, []);
  });
});
