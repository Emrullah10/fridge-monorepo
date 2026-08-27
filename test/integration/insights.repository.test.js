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
import { makeInsightsRepository } from '../../core/fridge-core/src/infrastructure/persistence/repositories/insights.repository.js';
import { makeInventoryItemRepository } from '../../core/fridge-core/src/infrastructure/persistence/repositories/inventory-item.repository.js';

const insightsRepo = makeInsightsRepository({ rawQuery });
const inventoryItemRepo = makeInventoryItemRepository({ rawQuery });

after(() => closeTestPool());

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
const wideWindow = { from: daysAgo(60), to: daysAgo(-1) };

describe('insights.repository — para & israf paneli', () => {
  test('consumed/recipe_used -> saved, expired/discarded -> wasted, receipt -> spent', async () => {
    const userId = await createTestUser('insights-basic');
    const householdId = await createTestHousehold(userId);
    const locationId = await createTestStorageLocation(householdId);
    const productId = await createTestProduct(householdId, 'Süt', 'liter');

    const item = await inventoryItemRepo.upsertQuantity({
      householdId, storageLocationId: locationId, productId, unit: 'liter', deltaQuantity: 10, unitPrice: 20,
    });

    // 4 satın alma (receipt): 4 * 20 = 80 spent
    await createStockMovement({ householdId, inventoryItemId: item.id, productId, delta: 4, reason: 'receipt', createdAt: daysAgo(10), unitPrice: 20, actorUserId: userId });
    // 2 tüketildi + 1 tarifte kullanıldı: (2+1) * 20 = 60 saved
    await createStockMovement({ householdId, inventoryItemId: item.id, productId, delta: -2, reason: 'consumed', createdAt: daysAgo(5), unitPrice: 20, actorUserId: userId });
    await createStockMovement({ householdId, inventoryItemId: item.id, productId, delta: -1, reason: 'recipe_used', createdAt: daysAgo(4), unitPrice: 20, actorUserId: userId });
    // 1 bozuldu + 1 son kullanma geçti: 2 * 20 = 40 wasted
    await createStockMovement({ householdId, inventoryItemId: item.id, productId, delta: -1, reason: 'discarded', createdAt: daysAgo(3), unitPrice: 20, actorUserId: userId });
    await createStockMovement({ householdId, inventoryItemId: item.id, productId, delta: -1, reason: 'expired', createdAt: daysAgo(2), unitPrice: 20, actorUserId: userId });

    const r = await insightsRepo.getHouseholdInsights({ householdId, ...wideWindow });

    assert.equal(r.saved, 60);
    assert.equal(r.wasted, 40);
    assert.equal(r.spent, 80);
    assert.equal(r.missingPriceCount, 0);
  });

  test('unit_price IS NULL hareketler toplamdan dışlanır, missingPriceCount ile raporlanır', async () => {
    const userId = await createTestUser('insights-nullprice');
    const householdId = await createTestHousehold(userId);
    const locationId = await createTestStorageLocation(householdId);
    const productId = await createTestProduct(householdId, 'Ekmek', 'piece');

    const item = await inventoryItemRepo.upsertQuantity({
      householdId, storageLocationId: locationId, productId, unit: 'piece', deltaQuantity: 5,
    });

    await createStockMovement({ householdId, inventoryItemId: item.id, productId, delta: -1, reason: 'consumed', createdAt: daysAgo(3), unitPrice: 8, actorUserId: userId });
    // fiyatsız iki hareket — toplama girmez
    await createStockMovement({ householdId, inventoryItemId: item.id, productId, delta: -1, reason: 'consumed', createdAt: daysAgo(2), unitPrice: null, actorUserId: userId });
    await createStockMovement({ householdId, inventoryItemId: item.id, productId, delta: -1, reason: 'discarded', createdAt: daysAgo(1), unitPrice: null, actorUserId: userId });

    const r = await insightsRepo.getHouseholdInsights({ householdId, ...wideWindow });

    assert.equal(r.saved, 8, 'sadece fiyatlı consumed sayılır');
    assert.equal(r.wasted, 0);
    assert.equal(r.missingPriceCount, 2);
  });

  test('byMember: kim ne kadar tüketti/israf etti kırılımı', async () => {
    const ownerId = await createTestUser('insights-member-owner');
    const householdId = await createTestHousehold(ownerId);
    const otherId = await createTestUser('insights-member-other');
    await rawQuery(
      `INSERT INTO household_member (household_id, user_id, role) VALUES ($1, $2, 'member')`,
      [householdId, otherId],
    );
    const locationId = await createTestStorageLocation(householdId);
    const productId = await createTestProduct(householdId, 'Peynir', 'gram');
    const item = await inventoryItemRepo.upsertQuantity({
      householdId, storageLocationId: locationId, productId, unit: 'gram', deltaQuantity: 10, unitPrice: 5,
    });

    await createStockMovement({ householdId, inventoryItemId: item.id, productId, delta: -2, reason: 'consumed', createdAt: daysAgo(3), unitPrice: 5, actorUserId: ownerId });
    await createStockMovement({ householdId, inventoryItemId: item.id, productId, delta: -1, reason: 'discarded', createdAt: daysAgo(2), unitPrice: 5, actorUserId: otherId });

    const r = await insightsRepo.getHouseholdInsights({ householdId, ...wideWindow });

    const byOwner = r.byMember.find((m) => m.userId === ownerId);
    const byOther = r.byMember.find((m) => m.userId === otherId);
    assert.ok(byOwner && byOwner.saved === 10 && byOwner.wasted === 0);
    assert.ok(byOther && byOther.wasted === 5 && byOther.saved === 0);
  });

  test('silinmiş inventory_item satırının fiyat snapshot\'ı analitikte hâlâ sayılır', async () => {
    const userId = await createTestUser('insights-deleted');
    const householdId = await createTestHousehold(userId);
    const locationId = await createTestStorageLocation(householdId);
    const productId = await createTestProduct(householdId, 'Tereyağı', 'gram');

    const item = await inventoryItemRepo.upsertQuantity({
      householdId, storageLocationId: locationId, productId, unit: 'gram', deltaQuantity: 4, unitPrice: 30,
    });
    await createStockMovement({ householdId, inventoryItemId: item.id, productId, delta: -1, reason: 'discarded', createdAt: daysAgo(2), unitPrice: 30, actorUserId: userId });

    await inventoryItemRepo.delete(item.id);

    const r = await insightsRepo.getHouseholdInsights({ householdId, ...wideWindow });
    assert.equal(r.wasted, 30, 'kalem silinse bile stock_movement.unit_price snapshot\'ı analitikte kalır');
    assert.equal(r.topWasted[0]?.wasted, 30);
  });

  test('dönem penceresi dışındaki hareketler sayılmaz', async () => {
    const userId = await createTestUser('insights-window');
    const householdId = await createTestHousehold(userId);
    const locationId = await createTestStorageLocation(householdId);
    const productId = await createTestProduct(householdId, 'Yoğurt', 'gram');
    const item = await inventoryItemRepo.upsertQuantity({
      householdId, storageLocationId: locationId, productId, unit: 'gram', deltaQuantity: 4, unitPrice: 12,
    });

    await createStockMovement({ householdId, inventoryItemId: item.id, productId, delta: -1, reason: 'consumed', createdAt: daysAgo(3), unitPrice: 12, actorUserId: userId });
    await createStockMovement({ householdId, inventoryItemId: item.id, productId, delta: -1, reason: 'consumed', createdAt: daysAgo(100), unitPrice: 12, actorUserId: userId });

    const r = await insightsRepo.getHouseholdInsights({ householdId, from: daysAgo(30), to: daysAgo(-1) });
    assert.equal(r.saved, 12, 'sadece son 30 gündeki hareket sayılmalı');
  });
});
