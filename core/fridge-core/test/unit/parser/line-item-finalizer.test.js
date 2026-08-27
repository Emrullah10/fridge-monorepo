import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { finalizeItem, resolveBrand, buildFinalName, parseMultipack } from '../../../src/infrastructure/parser/line-item-finalizer.js';

describe('resolveBrand', () => {
  // parsedBrand artık AI şemasında yok (performans: token azaltma, bkz.
  // process-receipt-scan.use-case.js dosya başı yorumu) — resolveBrand
  // tamamen sözlüğe (turkish-brands.js) dayanıyor, item.parsedBrand'a hiç
  // bakmıyor. Bu testler o kasıtlı davranışı kilitliyor.
  test('sözlükteki marka bulunur — modelin katkısı olmadan', () => {
    // Gerçek başarısızlık zamanında: model "Kruvasan"ı marka sanmıştı, oysa
    // 7Days marka. Artık modele hiç sorulmuyor, sözlük tek karar mercii.
    const brand = resolveBrand({ rawText: 'KRUVASAN 55G7DAYS' });
    assert.equal(brand, '7Days');
  });

  test('sözlükte olmayan marka null döner — artık model fallback yok', () => {
    // Önceki turda model çıktısına bakan bir fallback vardı; kaldırıldı.
    // Kapsanmayan markalar sözlüğe eklenerek (bkz. turkish-brands.js) telafi
    // ediliyor, "Zorbaş" gibi listede olmayanlar bilinçli olarak null kalır.
    const brand = resolveBrand({ rawText: 'ZORBAŞ SÜT 1LT' });
    assert.equal(brand, null);
  });

  test('marka yoksa null döner', () => {
    assert.equal(resolveBrand({ rawText: 'AYRAN' }), null);
  });
});

describe('buildFinalName', () => {
  test('marka isimde yoksa başa ekler', () => {
    assert.equal(buildFinalName('Kruvasan', '7Days'), '7Days Kruvasan');
  });

  test('marka zaten isimde varsa (başta) tekrar eklemez', () => {
    assert.equal(buildFinalName('7Days Kruvasan', '7Days'), '7Days Kruvasan');
  });

  test('marka isimde SONDA geçiyorsa başa ikinci kez eklemez — regresyon kilidi', () => {
    // Gerçek gözlem: model "Xroll Çilek Xroll" döndürdü, startsWith kontrolü
    // bunu kaçırıp başına bir "Xroll" daha ekliyordu ("Xroll Xroll Çilek Xroll").
    assert.equal(buildFinalName('Xroll Çilek Xroll', 'Xroll'), 'Xroll Çilek Xroll');
  });

  test('ölçü tekrarını isimden temizler', () => {
    assert.equal(buildFinalName('Mangoana 200G Kızıltılayıcı', null), 'Mangoana Kızıltılayıcı');
  });

  test('marka yoksa sadece temizlenmiş ismi döner', () => {
    assert.equal(buildFinalName('Tam Buğday Ekmeği', null), 'Tam Buğday Ekmeği');
  });
});

describe('finalizeItem (uçtan uca deterministik katman)', () => {
  test('gerçek fişteki marka/ürün-türü ters dönme hatasını düzeltir', () => {
    const result = finalizeItem({
      rawText: 'KRUVASAN 55G7DAYS',
      parsedName: 'Kruvasan',
      parsedBrand: 'Kruvasan',
      parsedQuantity: 1,
      parsedUnit: 'piece',
    });
    assert.equal(result.parsedBrand, '7Days');
    assert.equal(result.parsedName, '7Days Kruvasan');
    // "55G7DAYS" bitişik yazıldığı için MEASUREMENT_PATTERN'in aradığı \b
    // (kelime sınırı) ölçüden hemen sonra oluşmuyor — bilinen sınırlama,
    // ayrı bir iş (bkz. plan: "kapsam dışı"). Model'in kendi quantity/unit
    // çıktısı değişmeden kalır.
    assert.equal(result.parsedQuantity, 1);
    assert.equal(result.parsedUnit, 'piece');
  });

  test('Kiril homoglif bulaşmış model çıktısını temizler', () => {
    const result = finalizeItem({
      rawText: 'MİLKTEN 200G KAYMAK',
      parsedName: 'Milktен Kaymak',
      parsedBrand: 'Milktен',
      parsedQuantity: 200,
      parsedUnit: 'gram',
    });
    assert.equal(result.parsedBrand, 'Milkten');
    assert.equal(result.parsedName, 'Milkten Kaymak');
  });

  test('AI kategoriyi null bıraksa da içecek markası beverages\'a çeker — asıl regresyon kilidi (Kızılay Mangoana)', () => {
    const result = finalizeItem({
      rawText: 'MANGOANA6X200KIZTILAY %08',
      parsedName: 'Mangoana',
      parsedCategory: null,
      parsedQuantity: 1,
      parsedUnit: 'milliliter',
    });
    assert.equal(result.parsedBrand, 'Kızılay');
    assert.equal(result.parsedCategory, 'beverages');
    assert.equal(result.parsedName, 'Kızılay Mangoana');
  });

  test('AI YANLIŞ kategori verse bile marka sözlüğü ezer', () => {
    const result = finalizeItem({
      rawText: 'MANGOANA6X200KIZTILAY %08',
      parsedName: 'Mangoana',
      parsedCategory: 'produce',
      parsedQuantity: 1,
      parsedUnit: 'milliliter',
    });
    assert.equal(result.parsedCategory, 'beverages');
  });

  test('bilinmeyen marka için brandCategory devreye girmez, AI kategorisi aynen kalır', () => {
    const result = finalizeItem({
      rawText: 'SÜTAŞ SÜT 1LT',
      parsedName: 'Süt',
      parsedBrand: 'Sütaş',
      parsedCategory: 'dairy.milk',
      parsedQuantity: 1,
      parsedUnit: 'liter',
    });
    assert.equal(result.parsedCategory, 'dairy.milk');
  });
});

describe('parseMultipack', () => {
  test('birim soneki VAR — 6X200ML', () => {
    assert.deepEqual(parseMultipack('6X200ML MADEN SUYU'), { count: 6, size: 200, unit: 'milliliter' });
  });

  test('4X1LT', () => {
    assert.deepEqual(parseMultipack('4X1LT SU'), { count: 4, size: 1, unit: 'liter' });
  });

  test('boşluklu 2 X 500G', () => {
    assert.deepEqual(parseMultipack('2 X 500G PEYNIR'), { count: 2, size: 500, unit: 'gram' });
  });

  test('birim soneki YOK, bitişik OCR — MANGOANA6X200KIZTILAY', () => {
    assert.deepEqual(parseMultipack('MANGOANA6X200KIZTILAY %08'), { count: 6, size: 200, unit: null });
  });

  test('tek paket (1X500ML) çoklu paket SAYILMAZ', () => {
    assert.equal(parseMultipack('1X500ML SU TEK'), null);
  });

  test('multipack deseni yoksa null (mevcut davranış bozulmamalı)', () => {
    assert.equal(parseMultipack('SUT 1LT'), null);
  });

  test('birim yok + boyut >=1000 -> yıl/kod sanılıp reddedilir', () => {
    assert.equal(parseMultipack('12X2026'), null);
  });

  test('12X330ML', () => {
    assert.deepEqual(parseMultipack('12X330ML KOLA'), { count: 12, size: 330, unit: 'milliliter' });
  });
});

describe('finalizeItem — KRİTİK REGRESYON KİLİDİ: MANGOANA6X200KIZTILAY', () => {
  test('6 adet + 200 ml paket boyutu üretir, 1200 ml TEK KALEM üretmez', () => {
    const result = finalizeItem({
      rawText: 'MANGOANA6X200KIZTILAY %08',
      parsedName: 'Mangoana',
      parsedCategory: null,
      parsedQuantity: 1200, // AI'ın 8 taramanın birinde ürettiği YANLIŞ değer
      parsedUnit: 'milliliter',
    });
    assert.equal(result.parsedQuantity, 6);
    assert.equal(result.parsedUnit, 'piece');
    assert.equal(result.parsedPackSize, 200);
    assert.equal(result.parsedPackUnit, 'milliliter'); // brandCategory=beverages fallback devrede
    assert.equal(result.parsedBrand, 'Kızılay');
  });

  test('AI parsedUnit=piece dönse bile (8 taramanın 4ünde gözlendi) beverages fallback ile ml çözülür', () => {
    const result = finalizeItem({
      rawText: 'MANGOANA6X200KIZTILAY %08',
      parsedName: 'Mangoana',
      parsedQuantity: 1, // AI'ın "1 piece" dediği tarama
      parsedUnit: 'piece',
    });
    assert.equal(result.parsedQuantity, 6);
    assert.equal(result.parsedPackUnit, 'milliliter');
  });

  test('SUT 1LT hâlâ eski davranışta — regresyon yok', () => {
    const result = finalizeItem({ rawText: 'SUT 1LT', parsedName: 'Süt', parsedQuantity: 1, parsedUnit: 'piece' });
    assert.equal(result.parsedQuantity, 1);
    assert.equal(result.parsedUnit, 'liter');
    assert.equal(result.parsedPackSize, null);
  });

  test('2 X 500G PEYNIR -> 2 adet + 500g paket (eski davranış 1000g YANLIŞTI, artık düzeldi)', () => {
    const result = finalizeItem({ rawText: '2 X 500G PEYNIR', parsedName: 'Peynir', parsedQuantity: 2, parsedUnit: 'piece' });
    assert.equal(result.parsedQuantity, 2);
    assert.equal(result.parsedUnit, 'piece');
    assert.equal(result.parsedPackSize, 500);
    assert.equal(result.parsedPackUnit, 'gram');
  });

  test('birim soneği ve marka kategorisi ikisi de yoksa packSize null kalır, adet sayısı korunur', () => {
    const result = finalizeItem({ rawText: '6X4 YUMURTA', parsedName: 'Yumurta', parsedQuantity: 1, parsedUnit: 'piece' });
    assert.equal(result.parsedQuantity, 6);
    assert.equal(result.parsedUnit, 'piece');
    assert.equal(result.parsedPackSize, null);
    assert.equal(result.parsedPackUnit, null);
  });
});
