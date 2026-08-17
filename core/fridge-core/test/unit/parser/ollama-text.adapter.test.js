import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { finalizeItem, resolveBrand, buildFinalName } from '../../../src/infrastructure/parser/ollama-text.adapter.js';

describe('resolveBrand', () => {
  test('sözlük otoriter — modelin ters yaptığı marka/ürün-türü kararını ezer', () => {
    // Gerçek başarısızlık: model "Kruvasan"ı marka sandı, oysa 7Days marka.
    const brand = resolveBrand({ rawText: 'KRUVASAN 55G7DAYS', parsedBrand: 'Kruvasan' });
    assert.equal(brand, '7Days');
  });

  test('halüsinasyon kalkanı — ham metinde hiç geçmeyen marka atılır', () => {
    const brand = resolveBrand({ rawText: 'EKMEK TAM BUGDAY', parsedBrand: 'Uydurma Marka' });
    assert.equal(brand, null);
  });

  test('sözlükte olmayan ama ham metinde gerçekten geçen marka korunur', () => {
    const brand = resolveBrand({ rawText: 'ZORBAŞ SÜT 1LT', parsedBrand: 'Zorbaş' });
    assert.equal(brand, 'Zorbaş');
  });

  test('marka yoksa null döner', () => {
    assert.equal(resolveBrand({ rawText: 'AYRAN', parsedBrand: null }), null);
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
});
