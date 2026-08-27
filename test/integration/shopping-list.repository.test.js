import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

import { rawQuery, closeTestPool } from '../config/db-client.js';
import {
  createTestUser,
  createTestHousehold,
  createTestStorageLocation,
  createTestProduct,
  createStockMovement,
} from '../config/fixtures.js';
import { makeShoppingListRepository } from '../../core/fridge-core/src/infrastructure/persistence/repositories/shopping-list.repository.js';
import { makeInventoryItemRepository } from '../../core/fridge-core/src/infrastructure/persistence/repositories/inventory-item.repository.js';

const shoppingListRepo = makeShoppingListRepository({ rawQuery });
const inventoryItemRepo = makeInventoryItemRepository({ rawQuery });

after(() => closeTestPool());

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

describe('shopping-list.repository — consumptionProfile', () => {
  test('4 tüketim hareketi 10 günde bir -> avgIntervalDays ≈ 10, daysSinceLast doğru', async () => {
    const userId = await createTestUser('profile-basic');
    const householdId = await createTestHousehold(userId);
    const locationId = await createTestStorageLocation(householdId);
    const productId = await createTestProduct(householdId, 'Süt', 'liter');

    const item = await inventoryItemRepo.upsertQuantity({
      householdId, storageLocationId: locationId, productId, unit: 'liter', deltaQuantity: 4,
    });

    // 30, 20, 10, 0 gün önce tüketim: aralıklar 10-10-10, ortalama 10.
    for (const daysBack of [30, 20, 10, 0]) {
      await createStockMovement({
        householdId, inventoryItemId: item.id, productId, delta: -1, reason: 'consumed', createdAt: daysAgo(daysBack),
      });
    }

    const list = await shoppingListRepo.getOrCreateActiveList({ householdId, userId });
    const profile = await shoppingListRepo.consumptionProfile({ householdId, shoppingListId: list.id });

    assert.equal(profile.length, 1);
    assert.equal(profile[0].productId, productId);
    assert.ok(Math.abs(profile[0].avgIntervalDays - 10) < 1, `avgIntervalDays ~10 olmalı, geldi: ${profile[0].avgIntervalDays}`);
    assert.ok(profile[0].daysSinceLast < 1, 'son tüketim bugün olmalı');
  });

  test('tek hareketli ürün elenir (HAVING COUNT(*) >= 2)', async () => {
    const userId = await createTestUser('profile-single-event');
    const householdId = await createTestHousehold(userId);
    const locationId = await createTestStorageLocation(householdId);
    const productId = await createTestProduct(householdId, 'Tuz', 'gram');

    const item = await inventoryItemRepo.upsertQuantity({
      householdId, storageLocationId: locationId, productId, unit: 'gram', deltaQuantity: 1,
    });
    await createStockMovement({
      householdId, inventoryItemId: item.id, productId, delta: -1, reason: 'consumed', createdAt: daysAgo(5),
    });

    const list = await shoppingListRepo.getOrCreateActiveList({ householdId, userId });
    const profile = await shoppingListRepo.consumptionProfile({ householdId, shoppingListId: list.id });

    assert.equal(profile.length, 0, 'tek olaylı ürün yeterli istatistik üretmediği için elenmeli');
  });

  test('aktif listede zaten olan ürün önerilmez', async () => {
    const userId = await createTestUser('profile-in-list');
    const householdId = await createTestHousehold(userId);
    const locationId = await createTestStorageLocation(householdId);
    const productId = await createTestProduct(householdId, 'Yumurta', 'piece');

    const item = await inventoryItemRepo.upsertQuantity({
      householdId, storageLocationId: locationId, productId, unit: 'piece', deltaQuantity: 1,
    });
    for (const daysBack of [20, 10]) {
      await createStockMovement({
        householdId, inventoryItemId: item.id, productId, delta: -1, reason: 'consumed', createdAt: daysAgo(daysBack),
      });
    }

    const list = await shoppingListRepo.getOrCreateActiveList({ householdId, userId });
    await shoppingListRepo.addItem({ shoppingListId: list.id, productId, quantity: 1, unit: 'piece', addedBy: userId });

    const profile = await shoppingListRepo.consumptionProfile({ householdId, shoppingListId: list.id });
    assert.equal(profile.length, 0, 'zaten listede olan ürün tekrar önerilmemeli');
  });

  test('silinmiş inventory_item satırının tüketim geçmişi hâlâ sayılır (product_id denormalizasyonu)', async () => {
    const userId = await createTestUser('profile-deleted-item');
    const householdId = await createTestHousehold(userId);
    const locationId = await createTestStorageLocation(householdId);
    const productId = await createTestProduct(householdId, 'Zeytinyağı', 'liter');

    const item = await inventoryItemRepo.upsertQuantity({
      householdId, storageLocationId: locationId, productId, unit: 'liter', deltaQuantity: 1,
    });
    for (const daysBack of [15, 5]) {
      await createStockMovement({
        householdId, inventoryItemId: item.id, productId, delta: -1, reason: 'consumed', createdAt: daysAgo(daysBack),
      });
    }

    // inventory_item silinir — FK artık ON DELETE SET NULL (bkz.
    // 12-stock-movement-product.sql), stock_movement satırları kalır.
    await inventoryItemRepo.delete(item.id);

    const list = await shoppingListRepo.getOrCreateActiveList({ householdId, userId });
    const profile = await shoppingListRepo.consumptionProfile({ householdId, shoppingListId: list.id });

    assert.equal(profile.length, 1, 'envanter satırı silinse bile ürünün tüketim geçmişi kaybolmamalı');
    assert.equal(profile[0].productId, productId);
  });
});
