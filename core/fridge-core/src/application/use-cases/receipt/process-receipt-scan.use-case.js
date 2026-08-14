// Bir fişi kademe 1 (OCR) + kademe 2 (parser) + ürün eşleştirmeden geçirir.
// scan-processor worker'ı tarafından çağrılır. Hata durumunda fiş kaybolmaz,
// status 'failed' olur ve kullanıcı /retry ile tekrar deneyebilir.
const makeProcessReceiptScan = ({
  receiptScanRepo,
  receiptLineItemRepo,
  productAliasRepo,
  ocrPort,
  receiptParserPort,
}) => {
  const matchProduct = async ({ householdId, rawText }) => {
    const exact = await productAliasRepo.findExactMatch({ householdId, rawText });
    if (exact) {
      return { matchedProductId: exact.productId, confidence: 1.0, matchMethod: 'alias' };
    }

    const trigram = await productAliasRepo.findBestTrigramMatch({ householdId, rawText });
    if (trigram) {
      return { matchedProductId: trigram.productId, confidence: trigram.similarity, matchMethod: 'trigram' };
    }

    return { matchedProductId: null, confidence: null, matchMethod: null };
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
        const match = await matchProduct({ householdId: scan.householdId, rawText: line.rawText });
        lineItemsWithMatches.push({
          receiptScanId: scanId,
          householdId: scan.householdId,
          lineNo: line.lineNo,
          rawText: line.rawText,
          parsedName: line.parsedName,
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
