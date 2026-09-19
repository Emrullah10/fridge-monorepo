import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

import { rawQuery, closeTestPool } from '../config/db-client.js';
import { createTestUser } from '../config/fixtures.js';
import { makeUsageCounterRepository } from '../../core/fridge-core/src/infrastructure/persistence/repositories/usage-counter.repository.js';
import { makeDatasource } from '../../core/fridge-core/src/infrastructure/persistence/datasource.js';

// reserve() withTransaction gerektiriyor (bkz. usage-counter.repository.js
// başındaki yorum — pool-level rawQuery ile elle BEGIN/COMMIT farklı
// bağlantılara gidebilir). Ayrı bir datasource kuruyoruz, db-client.js'in
// rawQuery'si sadece tekil sorgular için yeterli.
const datasource = makeDatasource({ connectionString: process.env.DATABASE_URL });
const repo = makeUsageCounterRepository({ rawQuery, datasource });

after(async () => {
  await datasource.close();
  await closeTestPool();
});

describe('usage-counter.repository — getCurrentUsageForAllFeatures (Faz 0 performans turu)', () => {
  test('kullanım yoksa tüm özellikler used:0 ile döner', async () => {
    const userId = await createTestUser('usage-all-empty');
    const result = await repo.getCurrentUsageForAllFeatures({
      userId,
      features: ['receipt', 'recipe', 'chef', 'shopping'],
    });

    assert.deepEqual(Object.keys(result).sort(), ['chef', 'receipt', 'recipe', 'shopping']);
    for (const feature of Object.keys(result)) {
      assert.equal(result[feature].used, 0);
      assert.ok(result[feature].resetsAt, `${feature} resetsAt dolu olmalı`);
    }
  });

  test('eski getCurrentUsage (tek tek) ile TOPLU sonuç BİREBİR eşleşir — regresyon kilidi', async () => {
    const userId = await createTestUser('usage-all-vs-single');
    const features = ['receipt', 'recipe', 'chef', 'shopping'];

    // Gerçek kullanım üret: bazı özellikleri rezerve et, bazılarını boş bırak.
    await repo.reserve({ refId: `test-${Date.now()}-1`, userId, feature: 'receipt' });
    await repo.reserve({ refId: `test-${Date.now()}-2`, userId, feature: 'receipt' });
    await repo.reserve({ refId: `test-${Date.now()}-3`, userId, feature: 'chef' });
    // 'recipe' ve 'shopping' hiç kullanılmadı — used:0 dönmeli.

    const batch = await repo.getCurrentUsageForAllFeatures({ userId, features });

    const single = {};
    for (const feature of features) {
      single[feature] = await repo.getCurrentUsage({ userId, feature });
    }

    assert.deepEqual(batch, single, 'toplu ve tek tek sorgu AYNI sonucu vermeli');
    assert.equal(batch.receipt.used, 2);
    assert.equal(batch.chef.used, 1);
    assert.equal(batch.recipe.used, 0);
    assert.equal(batch.shopping.used, 0);
  });

  test('farklı kullanıcılar birbirinin kullanımını görmez (izolasyon)', async () => {
    const userA = await createTestUser('usage-iso-a');
    const userB = await createTestUser('usage-iso-b');

    await repo.reserve({ refId: `test-${Date.now()}-iso-a`, userId: userA, feature: 'receipt' });

    const resultA = await repo.getCurrentUsageForAllFeatures({ userId: userA, features: ['receipt'] });
    const resultB = await repo.getCurrentUsageForAllFeatures({ userId: userB, features: ['receipt'] });

    assert.equal(resultA.receipt.used, 1);
    assert.equal(resultB.receipt.used, 0);
  });

  test('resetsAt tüm özelliklerde AYNI değeri taşır (ayın ilk günü, tek doğruluk kaynağı)', async () => {
    const userId = await createTestUser('usage-resets-consistency');
    const result = await repo.getCurrentUsageForAllFeatures({
      userId,
      features: ['receipt', 'recipe'],
    });
    assert.equal(result.receipt.resetsAt.getTime(), result.recipe.resetsAt.getTime());
  });
});
