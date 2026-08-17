import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeProcessReceiptScan } from '../../../src/application/use-cases/receipt/process-receipt-scan.use-case.js';

// Sahte repository/port fabrikaları — DB'siz, Ollama'sız. Her testte
// taze bir state ile başlar.
const makeFakes = (overrides = {}) => {
  const scans = new Map([
    ['scan-1', { id: 'scan-1', householdId: 'hh-1', imagePath: null, rawText: null }],
  ]);
  const lineItemsCreated = [];
  const productsCreated = [];
  const aliasesUpserted = [];

  const receiptScanRepo = {
    findById: async (id) => scans.get(id),
    markReviewPending: async (id, data) => {
      const scan = scans.get(id);
      Object.assign(scan, data, { status: 'review_pending' });
      return scan;
    },
    markFailed: async (id, errorMessage) => {
      const scan = scans.get(id);
      Object.assign(scan, { status: 'failed', errorMessage });
      return scan;
    },
  };

  const receiptLineItemRepo = {
    createMany: async (items) => {
      lineItemsCreated.push(...items);
      return items;
    },
  };

  const productAliasRepo = {
    findExactMatch: async () => null,
    findBestTrigramMatch: async () => null,
    upsertUserCorrection: async (input) => {
      aliasesUpserted.push(input);
      return input;
    },
    ...overrides.productAliasRepo,
  };

  const productRepo = {
    create: async (input) => {
      const product = { id: `product-${productsCreated.length + 1}`, ...input };
      productsCreated.push(product);
      return product;
    },
    ...overrides.productRepo,
  };

  const productCategoryRepo = {
    findByKey: async (key) => (key ? { id: `category-${key}`, key } : null),
    ...overrides.productCategoryRepo,
  };

  const ocrPort = {
    extractText: async () => ({ rawText: 'fallback ocr text', provider: 'tesseract' }),
    ...overrides.ocrPort,
  };

  const receiptParserPort = {
    parse: async () => ({
      lineItems: [
        { lineNo: 1, rawText: 'BILINMEYEN URUN', parsedName: 'Bilinmeyen Ürün', parsedQuantity: 1, parsedUnit: 'piece' },
      ],
      merchantName: null,
      purchasedAt: null,
      totalAmount: null,
      provider: 'rule-based',
      model: 'none',
    }),
    ...overrides.receiptParserPort,
  };

  return {
    scans,
    lineItemsCreated,
    productsCreated,
    aliasesUpserted,
    receiptScanRepo,
    receiptLineItemRepo,
    productAliasRepo,
    productRepo,
    productCategoryRepo,
    ocrPort,
    receiptParserPort,
  };
};

describe('processReceiptScan — kademe 3: AI otomatik ürün oluşturma', () => {
  test('alias ve trigram bulunamayan satır için otomatik ürün açar, matchedProductId asla null kalmaz', async () => {
    const fakes = makeFakes();
    const processReceiptScan = makeProcessReceiptScan(fakes);

    await processReceiptScan({ scanId: 'scan-1', rawText: 'BILINMEYEN URUN' });

    assert.equal(fakes.productsCreated.length, 1);
    assert.equal(fakes.productsCreated[0].canonicalName, 'Bilinmeyen Ürün');
    assert.equal(fakes.productsCreated[0].source, 'ai_generated');

    assert.equal(fakes.lineItemsCreated.length, 1);
    assert.equal(fakes.lineItemsCreated[0].matchedProductId, 'product-1');
    assert.equal(fakes.lineItemsCreated[0].matchMethod, 'model');

    // Kimse doğrulamadığı için otomatik oluşturulan eşleşme düşük güvenli.
    assert.equal(fakes.lineItemsCreated[0].confidence, null);
  });

  test('AI oluşturduğu ürünü alias sözlüğüne de yazar (source: model) — ikinci gelişte tekrar model çağrılmasın diye', async () => {
    const fakes = makeFakes();
    const processReceiptScan = makeProcessReceiptScan(fakes);

    await processReceiptScan({ scanId: 'scan-1', rawText: 'BILINMEYEN URUN' });

    assert.equal(fakes.aliasesUpserted.length, 1);
    assert.equal(fakes.aliasesUpserted[0].source, 'model');
    assert.equal(fakes.aliasesUpserted[0].productId, 'product-1');
  });

  test('exact alias bulunursa AI ürün oluşturmaz, confidence 1.0 ve matchMethod alias olur', async () => {
    const fakes = makeFakes({
      productAliasRepo: {
        findExactMatch: async () => ({ productId: 'existing-product', productAlias: 'known' }),
      },
    });
    const processReceiptScan = makeProcessReceiptScan(fakes);

    await processReceiptScan({ scanId: 'scan-1', rawText: 'BILINMEYEN URUN' });

    assert.equal(fakes.productsCreated.length, 0, 'alias bulununca yeni ürün açılmamalı');
    assert.equal(fakes.lineItemsCreated[0].matchedProductId, 'existing-product');
    assert.equal(fakes.lineItemsCreated[0].matchMethod, 'alias');
    assert.equal(fakes.lineItemsCreated[0].confidence, 1.0);
  });

  test('trigram eşleşirse AI ürün oluşturmaz, benzerlik skorunu confidence olarak taşır', async () => {
    const fakes = makeFakes({
      productAliasRepo: {
        findExactMatch: async () => null,
        findBestTrigramMatch: async () => ({ productId: 'similar-product', similarity: 0.72 }),
      },
    });
    const processReceiptScan = makeProcessReceiptScan(fakes);

    await processReceiptScan({ scanId: 'scan-1', rawText: 'BILINMEYEN URUN' });

    assert.equal(fakes.productsCreated.length, 0);
    assert.equal(fakes.lineItemsCreated[0].matchedProductId, 'similar-product');
    assert.equal(fakes.lineItemsCreated[0].matchMethod, 'trigram');
    assert.equal(fakes.lineItemsCreated[0].confidence, 0.72);
  });

  test('parser hata fırlatırsa scan failed olur, exception dışarı sızmaz', async () => {
    const fakes = makeFakes({
      receiptParserPort: {
        parse: async () => { throw new Error('Ollama bağlantısı koptu'); },
      },
    });
    const processReceiptScan = makeProcessReceiptScan(fakes);

    const result = await processReceiptScan({ scanId: 'scan-1', rawText: 'herhangi bir metin' });

    assert.equal(result.status, 'failed');
    assert.equal(result.errorMessage, 'Ollama bağlantısı koptu');
    assert.equal(fakes.lineItemsCreated.length, 0);
  });

  test('rawText verilmezse (foto akışı) OCR portu çağrılır', async () => {
    let ocrCalled = false;
    const fakes = makeFakes({
      ocrPort: {
        extractText: async ({ imagePath }) => {
          ocrCalled = true;
          assert.equal(imagePath, null); // test fikstüründeki scan-1'in imagePath'i null
          return { rawText: 'ocr çıktısı', provider: 'tesseract' };
        },
      },
    });
    const processReceiptScan = makeProcessReceiptScan(fakes);

    await processReceiptScan({ scanId: 'scan-1' });

    assert.equal(ocrCalled, true);
  });

  test('rawText verilirse (mobil ML Kit akışı) OCR portu hiç çağrılmaz', async () => {
    let ocrCalled = false;
    const fakes = makeFakes({
      ocrPort: {
        extractText: async () => {
          ocrCalled = true;
          return { rawText: 'bu asla kullanılmamalı', provider: 'tesseract' };
        },
      },
    });
    const processReceiptScan = makeProcessReceiptScan(fakes);

    await processReceiptScan({ scanId: 'scan-1', rawText: 'mobilden gelen metin' });

    assert.equal(ocrCalled, false);
  });
});
