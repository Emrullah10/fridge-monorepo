import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

import { rawQuery, closeTestPool } from '../config/db-client.js';
import { createTestUser, createTestHousehold, createTestProduct } from '../config/fixtures.js';
import { makeProductAliasRepository } from '../../core/fridge-core/src/infrastructure/persistence/repositories/product-alias.repository.js';

const repo = makeProductAliasRepository({ rawQuery });

after(() => closeTestPool());

describe('product-alias.repository — öğrenme mekanizması (fiyattan bağımsız eşleşme)', () => {
  test('farklı fiyatla gelen aynı ürün satırı yine de tam eşleşir', async () => {
    const userId = await createTestUser('alias-price');
    const householdId = await createTestHousehold(userId);
    const productId = await createTestProduct(householdId, 'Coca-Cola', 'liter');

    await repo.upsertUserCorrection({
      householdId, rawText: 'COCA COLA 2.5LT      45,00', productId,
    });

    // Aynı ürün, farklı market, farklı fiyat — gerçek dünyada hep böyle olur.
    const match = await repo.findExactMatch({ householdId, rawText: 'COCA COLA 2.5LT      52,00' });

    assert.ok(match, 'fiyat farklı olsa da normalized_text üzerinden eşleşmeli');
    assert.equal(match.productId, productId);
  });

  test('aynı satırın tekrar düzeltilmesi hit_count arttırır, yeni kayıt açmaz', async () => {
    const userId = await createTestUser('alias-hitcount');
    const householdId = await createTestHousehold(userId);
    const productId = await createTestProduct(householdId, 'Domates');

    const first = await repo.upsertUserCorrection({ householdId, rawText: 'DOMATES KG  24,90', productId });
    const second = await repo.upsertUserCorrection({ householdId, rawText: 'DOMATES KG  31,50', productId });

    assert.equal(first.id, second.id, 'aynı normalized_text ikinci kez yeni satır açmamalı');
    assert.equal(second.hitCount, 2);
  });

  test('household izolasyonu: bir evin alias düzeltmesi başka evi etkilemez', async () => {
    const userA = await createTestUser('alias-iso-a');
    const userB = await createTestUser('alias-iso-b');
    const householdA = await createTestHousehold(userA);
    const householdB = await createTestHousehold(userB);
    const productA = await createTestProduct(householdA, 'A Evi Ürünü');

    await repo.upsertUserCorrection({ householdId: householdA, rawText: 'AYNI KISALTMA', productId: productA });

    const matchInB = await repo.findExactMatch({ householdId: householdB, rawText: 'AYNI KISALTMA' });
    assert.equal(matchInB, undefined, 'A evinin düzeltmesi B evinde görünmemeli');
  });

  test('yazım hatalı ama benzer satır trigram ile bulunur (tam eşleşme değil)', async () => {
    const userId = await createTestUser('alias-trigram');
    const householdId = await createTestHousehold(userId);
    const productId = await createTestProduct(householdId, 'Beyaz Peynir');

    await repo.upsertUserCorrection({ householdId, rawText: 'BEYAZ PEYNIR 500G', productId });

    // Tam eşleşme aranmasın, trigram'a düşsün.
    const exact = await repo.findExactMatch({ householdId, rawText: 'BEYAZ PEYNIR 500GR' });
    assert.equal(exact, undefined);

    const trigram = await repo.findBestTrigramMatch({ householdId, rawText: 'BEYAZ PEYNIR 500GR' });
    assert.ok(trigram, 'benzer metin trigram ile bulunmalı');
    assert.equal(trigram.productId, productId);
  });

  test('OCR/homoglif bozuk varyant aynı alias anahtarına düşer — asıl regresyon kilidi (Kızılay kirlenmesi)', async () => {
    // Gerçek DB kanıtı: "MİLKTEN 200G KAYMAK" (İ/homoglif temiz) ve
    // "MÌLKTEN 200G KAYMAK" (OCR'dan İ->Ì kaymış) iki farklı alias
    // anahtarına düşüyordu, aynı ürün iki kez ai_generated olarak
    // yaratılıyordu. normalizeAliasText artık normalizeOcrArtifacts +
    // stripHomoglyphs kullanıyor.
    const userId = await createTestUser('alias-ocr');
    const householdId = await createTestHousehold(userId);
    const productId = await createTestProduct(householdId, 'Milkten Kaymak');

    await repo.upsertUserCorrection({ householdId, rawText: 'MİLKTEN 200G KAYMAK', productId });

    const match = await repo.findExactMatch({ householdId, rawText: 'MÌLKTEN 200G KAYMAK' });
    assert.ok(match, 'OCR kod sayfası kayması (İ/Ì) aynı alias anahtarına düşmeli');
    assert.equal(match.productId, productId);
  });

  test('baştaki fiyat yıldızı ve TL sonekli satır sonu fiyatı da alias anahtarından temizlenir', async () => {
    const userId = await createTestUser('alias-price-variants');
    const householdId = await createTestHousehold(userId);
    const productId = await createTestProduct(householdId, 'Ayran');

    await repo.upsertUserCorrection({ householdId, rawText: '*AYRAN 250ML', productId });

    const match = await repo.findExactMatch({ householdId, rawText: 'AYRAN 250ML 9,90 TL' });
    assert.ok(match, 'baştaki yıldız ve TL sonekli fiyat da normalize edilmeli');
    assert.equal(match.productId, productId);
  });
});
