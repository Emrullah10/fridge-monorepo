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

  const products = new Map();
  const productRepo = {
    create: async (input) => {
      const product = { id: `product-${productsCreated.length + 1}`, ...input };
      productsCreated.push(product);
      products.set(product.id, product);
      return product;
    },
    // Ön-eşleştirme (alias/trigram ile bulunan satırlar) artık bunu
    // kullanıyor: eşleşen ürünün adı/birimi buradan okunur.
    findById: async (id) => products.get(id) ?? null,
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

  test('gerçek fiş gürültüsü (tarih/saat/TOPLAM) tek başına AI\'ı tetiklemez — regresyon kilidi', async () => {
    // Gerçek bug: rawLines filtrelenmeden alias aramasına giriyordu, "TOPLAM: 82,55"
    // gibi ürün-olmayan satırlar hiçbir zaman eşleşmediği için "unmatched" sayılıp
    // TEK BAŞLARINA Ollama'yı tetikliyordu — tüm gerçek ürünler alias'tan gelse bile.
    let parserCalled = false;
    const fakes = makeFakes({
      productAliasRepo: {
        findExactMatch: async () => ({ productId: 'existing-product' }),
      },
      receiptParserPort: {
        parse: async () => {
          parserCalled = true;
          throw new Error('AI çağrılmamalıydı — sadece gürültü satırları vardı');
        },
      },
    });
    const processReceiptScan = makeProcessReceiptScan(fakes);
    const rawText = ['30.01.2022', 'SAAT: 12:31:05', 'BILINEN URUN', 'TOPLAM: 82,55'].join('\n');

    const result = await processReceiptScan({ scanId: 'scan-1', rawText });

    assert.equal(parserCalled, false);
    assert.equal(result.status, 'review_pending');
    assert.equal(fakes.lineItemsCreated.length, 1); // sadece gerçek ürün satırı
    assert.equal(fakes.lineItemsCreated[0].rawText, 'BILINEN URUN');
  });

  test('gerçek bir fişteki salt fiyat/kısaltma gürültüsü ürün olarak kaydedilmez — regresyon kilidi (2026-08-18)', async () => {
    // Gerçek gözlem: Gemini geçişinde "*9,90" gibi salt fiyat satırları ve
    // "ARATOP"/"TOPKDY"/"TOPLAN" gibi kısaltma/OCR varyantları eski filtreyi
    // atlatıp AI'a gidiyor, "Unknown"/"Aratop" gibi çöp ürünler olarak
    // üretiliyor ve alias tablosuna kalıcı yazılıyordu (bkz. product-alias
    // repository testindeki eşleşen regresyon).
    let parserCalled = false;
    const fakes = makeFakes({
      productAliasRepo: {
        findExactMatch: async () => ({ productId: 'existing-product' }),
      },
      receiptParserPort: {
        parse: async () => {
          parserCalled = true;
          throw new Error('AI çağrılmamalıydı — sadece gürültü satırları vardı');
        },
      },
    });
    const processReceiptScan = makeProcessReceiptScan(fakes);
    const rawText = [
      '30.01.2022', 'SAAT: 12:31:05',
      'BILINEN URUN',
      'ARATOP', 'TOPKDY', 'TOPLAN', 'X08', 'K.Karti (tek pos)',
      '%08', 'FişNo: 0004',
      '*9,90', '*3,50', '*15, 90', '82,55', '*82,55 TL',
    ].join('\n');

    const result = await processReceiptScan({ scanId: 'scan-1', rawText });

    assert.equal(parserCalled, false);
    assert.equal(result.status, 'review_pending');
    assert.equal(fakes.lineItemsCreated.length, 1); // sadece gerçek ürün satırı
    assert.equal(fakes.lineItemsCreated[0].rawText, 'BILINEN URUN');
  });

  test('tüm satırlar alias/trigram ile eşleşirse AI hiç çağrılmaz — asıl hız kazancı', async () => {
    // Performans: Ollama pahalı (bkz. dosya başı yorum). İkinci taramada
    // aynı ürünler alias tablosunda hazır olduğu için modele gitmemeli.
    let parserCalled = false;
    const fakes = makeFakes({
      productAliasRepo: {
        findExactMatch: async () => ({ productId: 'existing-product', productAlias: 'known' }),
      },
      receiptParserPort: {
        parse: async () => {
          parserCalled = true;
          throw new Error('AI çağrılmamalıydı');
        },
      },
    });
    const processReceiptScan = makeProcessReceiptScan(fakes);

    const result = await processReceiptScan({ scanId: 'scan-1', rawText: 'BILINMEYEN URUN' });

    assert.equal(parserCalled, false);
    assert.equal(result.status, 'review_pending');
    assert.equal(fakes.lineItemsCreated.length, 1);
    assert.equal(fakes.lineItemsCreated[0].matchedProductId, 'existing-product');
    assert.equal(fakes.lineItemsCreated[0].matchMethod, 'alias');
  });

  test('bazı satırlar eşleşir bazıları eşleşmezse, sadece eşleşmeyenler AI\'a gider', async () => {
    const fakes = makeFakes({
      productAliasRepo: {
        findExactMatch: async ({ rawText }) => (rawText === 'BILINEN URUN' ? { productId: 'existing-product' } : null),
      },
      receiptParserPort: {
        parse: async ({ rawText }) => {
          assert.equal(rawText, 'BILINMEYEN URUN'); // sadece eşleşmeyen satır gitmeli
          return {
            lineItems: [
              { lineNo: 1, rawText: 'BILINMEYEN URUN', parsedName: 'Yeni Ürün', parsedQuantity: 1, parsedUnit: 'piece' },
            ],
            merchantName: null,
            purchasedAt: null,
            totalAmount: null,
            provider: 'rule-based',
            model: 'none',
          };
        },
      },
    });
    const processReceiptScan = makeProcessReceiptScan(fakes);

    await processReceiptScan({ scanId: 'scan-1', rawText: 'BILINEN URUN\nBILINMEYEN URUN' });

    assert.equal(fakes.lineItemsCreated.length, 2);
    const known = fakes.lineItemsCreated.find((i) => i.rawText === 'BILINEN URUN');
    const unknown = fakes.lineItemsCreated.find((i) => i.rawText === 'BILINMEYEN URUN');
    assert.equal(known.matchMethod, 'alias');
    assert.equal(unknown.matchMethod, 'model');
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

  test('modelin döndürdüğü gürültü satırı (TOPLAM/KDV) kart olarak kaydedilmez ve kalıcı ürün/alias yaratmaz — regresyon kilidi (2026-08-18)', async () => {
    // Gerçek bug: isNonProductLine yalnızca girdi (candidateLines) tarafında
    // uygulanıyordu. Model rawText'i yeniden yazabildiği için ("TOPLAM 82,55"
    // gibi bir satırı birleştirip döndürebiliyor) girdi filtresi bunu her
    // zaman yakalayamıyor; çıktı hiç filtrelenmediği için bu satır ürün
    // kartı olarak görünüyor VE matchProduct üzerinden kalıcı bir
    // ai_generated ürün + alias kaydına dönüşüyordu.
    const fakes = makeFakes({
      receiptParserPort: {
        parse: async () => ({
          lineItems: [
            { rawText: 'GERCEK URUN', parsedName: 'Gerçek Ürün', parsedQuantity: 1, parsedUnit: 'piece' },
            { rawText: 'TOPLAM 82,55', parsedName: 'Toplam', parsedQuantity: 1, parsedUnit: 'piece' },
          ],
          merchantName: null,
          purchasedAt: null,
          totalAmount: null,
          provider: 'gemini-text',
          model: 'gemini-2.5-flash',
        }),
      },
    });
    const processReceiptScan = makeProcessReceiptScan(fakes);

    const result = await processReceiptScan({ scanId: 'scan-1', rawText: 'GERCEK URUN\nTOPLAM 82,55' });

    assert.equal(result.status, 'review_pending');
    assert.equal(fakes.lineItemsCreated.length, 1);
    assert.equal(fakes.lineItemsCreated[0].rawText, 'GERCEK URUN');
    assert.equal(fakes.productsCreated.length, 1);
    assert.equal(fakes.productsCreated[0].canonicalName, 'Gerçek Ürün');
    assert.equal(fakes.aliasesUpserted.length, 1);
    assert.equal(fakes.aliasesUpserted[0].rawText, 'GERCEK URUN');
  });
});
