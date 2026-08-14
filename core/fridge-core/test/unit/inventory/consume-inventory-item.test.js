import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeConsumeInventoryItem } from '../../../src/application/use-cases/inventory/consume-inventory-item.use-case.js';

const makeFakes = () => {
  const items = new Map([
    ['item-1', { id: 'item-1', householdId: 'hh-1', productId: 'product-1', quantity: 5 }],
  ]);
  const movementsCreated = [];

  const inventoryItemRepo = {
    findById: async (id) => items.get(id),
    adjustQuantity: async ({ id, deltaQuantity }) => {
      const item = items.get(id);
      item.quantity += deltaQuantity;
      return item;
    },
  };

  const stockMovementRepo = {
    create: async (input) => {
      movementsCreated.push(input);
      return input;
    },
  };

  const productRepo = {
    findById: async (id) => ({ id, canonicalName: 'Test Ürün' }),
  };

  return { items, movementsCreated, inventoryItemRepo, stockMovementRepo, productRepo };
};

describe('consumeInventoryItem — household izolasyonu (IDOR regresyon testi)', () => {
  test('doğru householdId ile tüketim başarılı olur', async () => {
    const fakes = makeFakes();
    const consumeInventoryItem = makeConsumeInventoryItem(fakes);

    const result = await consumeInventoryItem({
      inventoryItemId: 'item-1',
      householdId: 'hh-1',
      quantity: 2,
      actorUserId: 'user-1',
    });

    assert.equal(result.quantity, 3);
    assert.equal(fakes.movementsCreated.length, 1);
    assert.equal(fakes.movementsCreated[0].delta, -2);
  });

  test('yanlış householdId ile NotFoundError fırlatır — başka evin envanterine erişilemez', async () => {
    const fakes = makeFakes();
    const consumeInventoryItem = makeConsumeInventoryItem(fakes);

    await assert.rejects(
      () => consumeInventoryItem({
        inventoryItemId: 'item-1',
        householdId: 'hh-2', // item-1 aslında hh-1'e ait
        quantity: 2,
        actorUserId: 'attacker',
      }),
      (error) => error.code === 'NOT_FOUND',
    );

    // Stok değişmemeli, hareket kaydı oluşmamalı.
    assert.equal(fakes.items.get('item-1').quantity, 5);
    assert.equal(fakes.movementsCreated.length, 0);
  });

  test('yetersiz stokta InsufficientStockError fırlatır, stok değişmez', async () => {
    const fakes = makeFakes();
    const consumeInventoryItem = makeConsumeInventoryItem(fakes);

    await assert.rejects(
      () => consumeInventoryItem({
        inventoryItemId: 'item-1',
        householdId: 'hh-1',
        quantity: 99,
        actorUserId: 'user-1',
      }),
    );

    assert.equal(fakes.items.get('item-1').quantity, 5);
    assert.equal(fakes.movementsCreated.length, 0);
  });
});
