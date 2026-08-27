import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeLookupBarcode } from '../../../src/application/use-cases/product/lookup-barcode.use-case.js';

describe('makeLookupBarcode', () => {
  test('8 haneden kısa barkod reddedilir', async () => {
    const useCase = makeLookupBarcode({ productRepo: {}, barcodeLookupPort: {} });
    await assert.rejects(() => useCase({ barcode: '123' }));
  });

  test('katalogda barkodlu ürün varsa OFF çağrılmaz', async () => {
    let offCalled = false;
    const useCase = makeLookupBarcode({
      productRepo: { findByBarcode: async () => ({ id: 'p1', canonicalName: 'Süt', barcode: '8690000000001' }) },
      barcodeLookupPort: { lookup: async () => { offCalled = true; return null; } },
    });
    const result = await useCase({ barcode: '8690000000001' });
    assert.equal(offCalled, false);
    assert.equal(result.found, true);
    assert.equal(result.source, 'catalog');
    assert.equal(result.product.id, 'p1');
  });

  test('katalogda yoksa OFF sonucundan yeni ürün yaratılır (besin değeriyle)', async () => {
    let createdWith;
    const useCase = makeLookupBarcode({
      productRepo: {
        findByBarcode: async () => null,
        create: async (data) => { createdWith = data; return { id: 'new-1', ...data }; },
      },
      barcodeLookupPort: {
        lookup: async () => ({
          barcode: '8690000000002',
          name: 'Kaşar Peyniri',
          brand: 'Pınar',
          packText: '400 g',
          nutrition: { kcal: 330, protein: 25, carb: 1, fat: 26, basis: '100g' },
        }),
      },
    });
    const result = await useCase({ barcode: '8690000000002' });

    assert.equal(result.found, true);
    assert.equal(result.source, 'openfoodfacts');
    assert.equal(createdWith.canonicalName, 'Kaşar Peyniri');
    assert.equal(createdWith.barcode, '8690000000002');
    assert.equal(createdWith.nutrition.kcal, 330);
    assert.equal(createdWith.source, 'user');
  });

  test('OFF de bulamazsa found:false + barkod döner', async () => {
    const useCase = makeLookupBarcode({
      productRepo: { findByBarcode: async () => null },
      barcodeLookupPort: { lookup: async () => null },
    });
    const result = await useCase({ barcode: '8690000000003' });
    assert.deepEqual(result, { found: false, barcode: '8690000000003' });
  });

  test('barkoddaki rakam olmayan karakterler temizlenir', async () => {
    let lookedUp;
    const useCase = makeLookupBarcode({
      productRepo: { findByBarcode: async (b) => { lookedUp = b; return null; } },
      barcodeLookupPort: { lookup: async () => null },
    });
    await useCase({ barcode: ' 869-000 000 004 ' });
    assert.equal(lookedUp, '869000000004');
  });
});
