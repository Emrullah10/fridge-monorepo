import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

import { rawQuery, closeTestPool } from '../config/db-client.js';
import { createTestUser, createTestHousehold } from '../config/fixtures.js';
import { makeProductRepository } from '../../core/fridge-core/src/infrastructure/persistence/repositories/product.repository.js';

const repo = makeProductRepository({ rawQuery });

after(() => closeTestPool());

describe('product.repository — pack_size/pack_unit (çoklu paket)', () => {
  test('create paket boyutuyla birlikte ürün yaratır, findById/mapRow doğru döndürür', async () => {
    const userId = await createTestUser('pack-create');
    const householdId = await createTestHousehold(userId);

    const created = await repo.create({
      householdId,
      canonicalName: 'Kızılay Mangoana',
      brand: 'Kızılay',
      defaultUnit: 'piece',
      source: 'ai_generated',
      packSize: 200,
      packUnit: 'milliliter',
    });

    assert.equal(created.packSize, 200);
    assert.equal(created.packUnit, 'milliliter');

    const found = await repo.findById(created.id);
    assert.equal(found.packSize, 200);
    assert.equal(found.packUnit, 'milliliter');
  });

  test('packSize/packUnit verilmezse null döner (geriye dönük uyumluluk)', async () => {
    const userId = await createTestUser('pack-null');
    const householdId = await createTestHousehold(userId);

    const created = await repo.create({ householdId, canonicalName: 'Domates', defaultUnit: 'kilogram' });

    assert.equal(created.packSize, null);
    assert.equal(created.packUnit, null);
  });

  test('updatePackSize kullanıcı düzeltmesini kalıcılaştırır', async () => {
    const userId = await createTestUser('pack-update');
    const householdId = await createTestHousehold(userId);
    const created = await repo.create({ householdId, canonicalName: 'CP Sosis 500G', defaultUnit: 'piece' });

    const updated = await repo.updatePackSize(created.id, { packSize: 500, packUnit: 'gram' });

    assert.equal(updated.packSize, 500);
    assert.equal(updated.packUnit, 'gram');
  });

  test('DB CHECK kısıtı: pack_size dolu pack_unit boş olamaz', async () => {
    const userId = await createTestUser('pack-check');
    const householdId = await createTestHousehold(userId);

    await assert.rejects(
      rawQuery(
        `INSERT INTO product (household_id, canonical_name, default_unit, source, pack_size, pack_unit)
         VALUES ($1, 'Kısıt İhlali', 'piece', 'user', 200, NULL)`,
        [householdId],
      ),
    );
  });
});
