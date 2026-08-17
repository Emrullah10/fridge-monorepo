// Bir fişi kademe 1 (OCR) + kademe 2 (parser) + ürün eşleştirmeden geçirir.
// scan-processor worker'ı tarafından çağrılır. Hata durumunda fiş kaybolmaz,
// status 'failed' olur ve kullanıcı /retry ile tekrar deneyebilir.
const makeProcessReceiptScan = ({
  receiptScanRepo,
  receiptLineItemRepo,
  productAliasRepo,
  productRepo,
  productCategoryRepo,
  ocrPort,
  receiptParserPort,
}) => {
  // Kademe 3: alias/trigram bulamazsa, Ollama'nın zaten ürettiği parsedName
  // ile household'a özel bir ürün otomatik açılır. Böylece matchedProductId
  // hiçbir satırda null kalmaz — yeni bir evde bile onay akışı çalışabilir.
  // Kullanıcı düzeltirse (isim yanlışsa ya da mevcut bir ürünle birleştirmek
  // isterse) normal alias öğrenmesi zaten devreye girer.
  //
  // categoryId burada kalıcı olarak yazılıyor (sadece bu satırın önerisi
  // için değil) — aynı ürün bir dahaki fişte alias/trigram ile eşleştiğinde
  // kategorisi zaten hazır olsun, AI'a tekrar ihtiyaç kalmasın.
  const matchProduct = async ({ householdId, rawText, parsedName, parsedBrand, parsedCategory, parsedUnit }) => {
    const exact = await productAliasRepo.findExactMatch({ householdId, rawText });
    if (exact) {
      return { matchedProductId: exact.productId, confidence: 1.0, matchMethod: 'alias' };
    }

    const trigram = await productAliasRepo.findBestTrigramMatch({ householdId, rawText });
    if (trigram) {
      return { matchedProductId: trigram.productId, confidence: trigram.similarity, matchMethod: 'trigram' };
    }

    const category = await productCategoryRepo.findByKey(parsedCategory);
    const created = await productRepo.create({
      householdId,
      canonicalName: parsedName,
      brand: parsedBrand,
      categoryId: category?.id ?? null,
      defaultUnit: parsedUnit,
      source: 'ai_generated',
    });
    await productAliasRepo.upsertUserCorrection({ householdId, rawText, productId: created.id, source: 'model' });
    return { matchedProductId: created.id, confidence: null, matchMethod: 'model' };
  };

  return async ({ scanId, rawText: providedRawText }) => {
    const scan = await receiptScanRepo.findById(scanId);

    try {
      // Mobil zaten metni çıkardıysa (ML Kit) kademe 1 tamamen atlanır.
      const { rawText, provider: ocrProvider } = providedRawText
        ? { rawText: providedRawText, provider: 'mlkit-mobile' }
        : await ocrPort.extractText({ imagePath: scan.imagePath });

      const parsed = await receiptParserPort.parse({ rawText });

      const lineItemsWithMatches = [];
      for (const line of parsed.lineItems) {
        const match = await matchProduct({
          householdId: scan.householdId,
          rawText: line.rawText,
          parsedName: line.parsedName,
          parsedBrand: line.parsedBrand ?? null,
          parsedCategory: line.parsedCategory ?? null,
          parsedUnit: line.parsedUnit,
        });
        lineItemsWithMatches.push({
          receiptScanId: scanId,
          householdId: scan.householdId,
          lineNo: line.lineNo,
          rawText: line.rawText,
          parsedName: line.parsedName,
          parsedBrand: line.parsedBrand ?? null,
          parsedQuantity: line.parsedQuantity,
          parsedUnit: line.parsedUnit,
          parsedPrice: line.parsedPrice ?? null,
          matchedProductId: match.matchedProductId,
          confidence: match.confidence,
          matchMethod: match.matchMethod,
        });
      }

      await receiptLineItemRepo.createMany(lineItemsWithMatches);

      return receiptScanRepo.markReviewPending(scanId, {
        rawText,
        ocrProvider,
        parserProvider: parsed.provider,
        parserModel: parsed.model,
        merchantName: parsed.merchantName,
        purchasedAt: parsed.purchasedAt,
        totalAmount: parsed.totalAmount,
      });
    } catch (error) {
      return receiptScanRepo.markFailed(scanId, error.message);
    }
  };
};

export { makeProcessReceiptScan };
