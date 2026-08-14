import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

import { rawQuery, closeTestPool } from '../config/db-client.js';
import { createTestUser, createTestHousehold, createTestStorageLocation, createTestProduct } from '../config/fixtures.js';
import { makeInventoryItemRepository } from '../../core/fridge-core/src/infrastructure/persistence/repositories/inventory-item.repository.js';

const repo = makeInventoryItemRepository({ rawQuery });

after(() => closeTestPool());

describe('inventory-item.repository — upsert doğruluğu', () => {
  test('aynı ürün + lokasyon + birim + SKT tekrar eklenince miktar birleşir, yeni satır açılmaz', async () => {
    const userId = await createTestUser('upsert');
    const householdId = await createTestHousehold(userId);
    const locationId = await createTestStorageLocation(householdId);
    const productId = await createTestProduct(householdId, 'Süt', 'liter');

    const first = await repo.upsertQuantity({
      householdId, storageLocationId: locationId, productId, unit: 'liter', deltaQuantity: 1,
    });
    const second = await repo.upsertQuantity({
      householdId, storageLocationId: locationId, productId, unit: 'liter', deltaQuantity: 1,
    });

    assert.equal(first.id, second.id, 'aynı satır güncellenmeli, yeni satır açılmamalı');
    assert.equal(second.quantity, 2);

    const items = await repo.listByHousehold(householdId);
    assert.equal(items.length, 1);
  });

  test('SKT NULL olan satırlarda da upsert doğru birleşir (NULL != NULL tuzağı)', async () => {
    const userId = await createTestUser('upsert-null-skt');
    const householdId = await createTestHousehold(userId);
    const locationId = await createTestStorageLocation(householdId);
    const productId = await createTestProduct(householdId, 'Ekmek', 'piece');

    await repo.upsertQuantity({
      householdId, storageLocationId: locationId, productId, unit: 'piece', expiresAt: null, deltaQuantity: 1,
    });
    await repo.upsertQuantity({
      householdId, storageLocationId: locationId, productId, unit: 'piece', expiresAt: null, deltaQuantity: 1,
    });

    const items = await repo.listByHousehold(householdId);
    assert.equal(items.length, 1, 'SKT null olsa bile aynı satır güncellenmeli');
    assert.equal(items[0].quantity, 2);
  });

  test('farklı SKT verilirse ayrı satır açılır (aynı ürün farklı parti)', async () => {
    const userId = await createTestUser('upsert-diff-skt');
    const householdId = await createTestHousehold(userId);
    const locationId = await createTestStorageLocation(householdId);
    const productId = await createTestProduct(householdId, 'Yoğurt', 'kilogram');

    await repo.upsertQuantity({
      householdId, storageLocationId: locationId, productId, unit: 'kilogram', expiresAt: '2026-01-01', deltaQuantity: 1,
    });
    await repo.upsertQuantity({
      householdId, storageLocationId: locationId, productId, unit: 'kilogram', expiresAt: '2026-06-01', deltaQuantity: 1,
    });

    const items = await repo.listByHousehold(householdId);
    assert.equal(items.length, 2, 'farklı SKT ayrı satır olmalı');
  });
});

describe('inventory-item.repository — household izolasyonu (defense in depth)', () => {
  test('listByHousehold başka evin ürünlerini asla döndürmez', async () => {
    const userA = await createTestUser('iso-a');
    const userB = await createTestUser('iso-b');
    const householdA = await createTestHousehold(userA, 'Ev A');
    const householdB = await createTestHousehold(userB, 'Ev B');
    const locationA = await createTestStorageLocation(householdA);
    const locationB = await createTestStorageLocation(householdB);
    const productA = await createTestProduct(householdA, 'A Ürünü');
    const productB = await createTestProduct(householdB, 'B Ürünü');

    await repo.upsertQuantity({
      householdId: householdA, storageLocationId: locationA, productId: productA, unit: 'piece', deltaQuantity: 3,
    });
    await repo.upsertQuantity({
      householdId: householdB, storageLocationId: locationB, productId: productB, unit: 'piece', deltaQuantity: 7,
    });

    const itemsA = await repo.listByHousehold(householdA);
    const itemsB = await repo.listByHousehold(householdB);

    assert.equal(itemsA.length, 1);
    assert.equal(itemsA[0].productName, 'A Ürünü');
    assert.equal(itemsB.length, 1);
    assert.equal(itemsB[0].productName, 'B Ürünü');
  });
});
