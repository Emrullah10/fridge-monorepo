import { normalizeMeasurement } from '../../../infrastructure/parser/line-item-finalizer.js';
import { extractMerchantFromRawText } from '../../../infrastructure/parser/turkish-merchants.js';
import { NOTIFICATION_TYPES } from '../../../domain/notification-types.js';
import { isNonProductLine } from '../../../domain/receipt-line-filter.js';
import { attachPrices } from '../../../domain/receipt-price.js';

// Ön-eşleştirme sonrası fişin tamamı modele gitmeyebiliyor (hatta hiç
// gitmeyebiliyor), dolayısıyla toplam tutarı modelden beklemek güvenilmez —
// ham metinden deterministik okuyoruz. Adapter'daki aynı desen.
const TOTAL_PATTERN = /^\s*(?:GENEL\s+)?TOPLAM\s*[:\s]\s*([\d.,]+)\s*$/im;

const extractTotalFromRawText = (rawText) => {
  const match = TOTAL_PATTERN.exec(rawText ?? '');
  if (!match) return null;
  const amount = Number(match[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(amount) ? amount : null;
};

// isNonProductLine artık domain/receipt-line-filter.js'de — hem burada hem
// domain/receipt-price.js'de (fiyat çıkarımı, filtre uygulanmadan ÖNCE ham
// satırlara bakar) hem prompt kural 6'da (line-item-finalizer.js) aynı
// kaynaktan besleniyor.

// Bir fişi kademe 1 (OCR) + kademe 2 (parser) + ürün eşleştirmeden geçirir.
// scan-processor worker'ı tarafından çağrılır. Hata durumunda fiş kaybolmaz,
// status 'failed' olur ve kullanıcı /retry ile tekrar deneyebilir.
//
// PERFORMANS: Yerel Ollama modeli bu donanımda ~13 token/s üretiyor ve fiş başına ~800
// token istiyorduk — taramalar 58-102sn sürüp mobilde timeout'a yol açtı.
// Bu yüzden sözlük (alias) araması AI'dan ÖNCE yapılıyor: daha önce görülmüş
// satırlar modele hiç gönderilmiyor. Alias tablosu hem kullanıcı
// düzeltmelerinden hem AI'ın ürettiği ürünlerden kendiliğinden büyüdüğü için
// aynı marketin ikinci/üçüncü fişi neredeyse anlık işleniyor.
const makeProcessReceiptScan = ({
  receiptScanRepo,
  receiptLineItemRepo,
  productAliasRepo,
  productRepo,
  productCategoryRepo,
  ocrPort,
  receiptParserPort,
  notifyHousehold,
  // Kota rezervasyonu route katmanında scanId oluşur oluşmaz yapılır (bkz.
  // receipt.routes.js). Terminal hata VEYA 0-ürün sonucunda burada iade
  // edilir — kullanıcı bir değer almadıysa ödemez (plan §Faz 3). Opsiyonel:
  // enjekte edilmezse eski davranış (iade yok) korunur, testler kırılmaz.
  releaseAiUsage,
}) => {
  // Kademe 3: alias/trigram bulamazsa, AI parser'ın zaten ürettiği parsedName
  // ile household'a özel bir ürün otomatik açılır. Böylece matchedProductId
  // hiçbir satırda null kalmaz — yeni bir evde bile onay akışı çalışabilir.
  // Kullanıcı düzeltirse (isim yanlışsa ya da mevcut bir ürünle birleştirmek
  // isterse) normal alias öğrenmesi zaten devreye girer.
  //
  // categoryId burada kalıcı olarak yazılıyor (sadece bu satırın önerisi
  // için değil) — aynı ürün bir dahaki fişte alias/trigram ile eşleştiğinde
  // kategorisi zaten hazır olsun, AI'a tekrar ihtiyaç kalmasın.
  // Kademe 1+2: sözlük araması. AI'dan ÖNCE de (ön-eşleştirme), AI'ın
  // döndürdüğü satırlar için de burası kullanılıyor. Bulamazsa null.
  const matchKnownProduct = async ({ householdId, rawText }) => {
    const exact = await productAliasRepo.findExactMatch({ householdId, rawText });
    if (exact) {
      return { matchedProductId: exact.productId, confidence: 1.0, matchMethod: 'alias' };
    }

    const trigram = await productAliasRepo.findBestTrigramMatch({ householdId, rawText });
    if (trigram) {
      return { matchedProductId: trigram.productId, confidence: trigram.similarity, matchMethod: 'trigram' };
    }

    return null;
  };

  const matchProduct = async ({ householdId, rawText, parsedName, parsedBrand, parsedCategory, parsedUnit, parsedPackSize, parsedPackUnit }) => {
    const known = await matchKnownProduct({ householdId, rawText });
    if (known) return known;

    const category = await productCategoryRepo.findByKey(parsedCategory);
    const created = await productRepo.create({
      householdId,
      canonicalName: parsedName,
      brand: parsedBrand,
      categoryId: category?.id ?? null,
      defaultUnit: parsedUnit,
      source: 'ai_generated',
      packSize: parsedPackSize ?? null,
      packUnit: parsedPackUnit ?? null,
    });
    await productAliasRepo.upsertUserCorrection({ householdId, rawText, productId: created.id, source: 'model' });
    return { matchedProductId: created.id, confidence: null, matchMethod: 'model' };
  };

  // Sözlükte eşleşen satır için AI'a gerek yok: ürün adı/kategorisi zaten
  // eşleşen üründe hazır, miktar/birim de ham metinden deterministik
  // çıkarılıyor (normalizeMeasurement, AI çıktısına da uygulanan aynı regex).
  //
  // Paket boyutu için ürün OTORİTER kaynak: product.packSize/packUnit varsa
  // ham metinden yeniden tahmin edilmez, doğrudan kullanılır. Ürün henüz
  // paket bilgisi taşımıyorsa (ör. eski/manuel kayıt) normalizeMeasurement'ın
  // ham metinden çıkardığı değere düşülür.
  const buildLineFromMatchedProduct = async ({ rawText, match, parsedPrice }) => {
    const product = await productRepo.findById(match.matchedProductId);
    const measured = normalizeMeasurement({
      rawText,
      parsedQuantity: 1,
      parsedUnit: product?.defaultUnit ?? 'piece',
    });
    const packUnit = product?.packUnit ?? measured.parsedPackUnit ?? null;
    return {
      rawText,
      parsedName: product?.canonicalName ?? rawText,
      parsedBrand: product?.brand ?? null,
      parsedQuantity: measured.parsedQuantity,
      parsedUnit: measured.parsedUnit,
      // CHECK kısıtı gereği (pack_size IS NULL) = (pack_unit IS NULL):
      // birim yoksa boyut da yazılmaz.
      parsedPackSize: packUnit ? (product?.packSize ?? measured.parsedPackSize ?? null) : null,
      parsedPackUnit: packUnit,
      // attachPrices ile ham metinden deterministik çıkarılan satır toplamı.
      // Bu yol (alias/trigram) baskın yol olduğu için (tekrar alınan ürünler,
      // yani aylık harcamanın çoğu) burada null bırakmak para panelini
      // sürekli boş tutuyordu.
      parsedPrice: parsedPrice ?? null,
      ...match,
    };
  };

  return async ({ scanId, rawText: providedRawText }) => {
    const scan = await receiptScanRepo.findById(scanId);

    try {
      // Mobil zaten metni çıkardıysa (ML Kit) kademe 1 tamamen atlanır.
      const { rawText, provider: ocrProvider } = providedRawText
        ? { rawText: providedRawText, provider: 'mlkit-mobile' }
        : await ocrPort.extractText({ imagePath: scan.imagePath });

      // 1) Sözlük geçişi: ürün OLABİLECEK ham satırları alias/trigram ile
      //    dene. Tarih/saat/TOPLAM gibi satırlar hiç denenmez — zaten hiçbir
      //    ürüne eşleşmezler, "unmatched" sayılıp gereksiz yere AI'ı
      //    tetiklerlerdi (tüm ürünler alias'tan gelse bile).
      const rawLines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

      // Fiyat çıkarımı filtre uygulanmadan ÖNCE, ham satırlar üzerinde
      // çalışır — çünkü fiyat satırları (örn. "*9,90") tam olarak
      // isNonProductLine'ın elediği satırlardır. AMOUNT_ONLY_LINE_PATTERN'a
      // takılıp modele hiç gitmeyen bu satırlar burada komşu ürün adayına
      // bağlanıyor (bkz. domain/receipt-price.js).
      const { takePrice } = attachPrices(rawLines, isNonProductLine);

      const candidateLines = rawLines.filter((line) => !isNonProductLine(line));
      const resolvedLines = [];
      const unmatchedLines = [];
      for (const line of candidateLines) {
        const match = await matchKnownProduct({ householdId: scan.householdId, rawText: line });
        if (match) {
          resolvedLines.push(
            await buildLineFromMatchedProduct({ rawText: line, match, parsedPrice: takePrice(line) }),
          );
        } else {
          unmatchedLines.push(line);
        }
      }

      // Ham metinden deterministik olarak çıkarılan market adı. AI'ın
      // merchantName alanı alias-only yolda hiç çağrılmadığı için boş
      // kalabiliyor (bkz. aşağıdaki markReviewPending) — bu hem o boşluğu
      // dolduran bir yedek, hem de AI çağrıldığında parser'a context olarak
      // gidiyor (zincire özgü kısaltmaları açmasına yardım eder).
      const merchantHint = extractMerchantFromRawText(rawText);

      // 2) Sadece tanınmayan satırlar modele gider. Hepsi tanındıysa AI parser
      //    hiç çağrılmaz — asıl hız kazancı burada.
      const parsed = unmatchedLines.length > 0
        ? await receiptParserPort.parse({ rawText: unmatchedLines.join('\n'), merchantHint })
        : { lineItems: [], merchantName: null, purchasedAt: null, totalAmount: null, provider: 'alias-only', model: null };

      // 3) Modelin döndürdüğü satırlar kademe 3'ten (AI ürün oluşturma) geçer.
      //    Girdi filtresi (candidateLines) modele hiç göndermediği satırları
      //    eler, ama model rawText'i serbestçe yeniden yazabildiği için
      //    (bitişik satırları birleştirme, kısaltma açma) çıktı tarafında da
      //    aynı filtre gerekiyor — yoksa "Toplam" gibi çöp bir parsedName
      //    matchProduct'a girip kalıcı bir ai_generated ürün + alias yaratıyor.
      const aiLines = [];
      for (const line of parsed.lineItems) {
        if (isNonProductLine(line.rawText) || isNonProductLine(line.parsedName)) continue;

        const match = await matchProduct({
          householdId: scan.householdId,
          rawText: line.rawText,
          parsedName: line.parsedName,
          parsedBrand: line.parsedBrand ?? null,
          parsedCategory: line.parsedCategory ?? null,
          parsedUnit: line.parsedUnit,
          parsedPackSize: line.parsedPackSize ?? null,
          parsedPackUnit: line.parsedPackUnit ?? null,
        });
        // Ham metinden deterministik çıkarılan fiyat modelinkini ezer — model
        // fiyat konusunda halüsinasyon yapabiliyor (bkz. multipack miktar
        // hatası dersi, cerebrum 2026-08-26: aynı satır 4 farklı sonuç
        // vermişti). Deterministik yol bulamazsa modelin kendi parsedPrice'ına
        // düşülür (nadiren fiyat aynı satırda kalmış olabilir).
        aiLines.push({
          rawText: line.rawText,
          parsedName: line.parsedName,
          parsedBrand: line.parsedBrand ?? null,
          parsedQuantity: line.parsedQuantity,
          parsedUnit: line.parsedUnit,
          parsedPackSize: line.parsedPackSize ?? null,
          parsedPackUnit: line.parsedPackUnit ?? null,
          parsedPrice: takePrice(line.rawText) ?? line.parsedPrice ?? null,
          ...match,
        });
      }

      // Satırları fişteki orijinal sırasına göre diz — kullanıcı inceleme
      // ekranında fişle yan yana okuyabilsin.
      const orderOf = new Map(rawLines.map((line, index) => [line, index]));
      const lineItemsWithMatches = [...resolvedLines, ...aiLines]
        .sort((a, b) => (orderOf.get(a.rawText) ?? 0) - (orderOf.get(b.rawText) ?? 0))
        .map((line, index) => ({
          receiptScanId: scanId,
          householdId: scan.householdId,
          lineNo: index + 1,
          ...line,
        }));

      await receiptLineItemRepo.createMany(lineItemsWithMatches);

      const result = await receiptScanRepo.markReviewPending(scanId, {
        rawText,
        ocrProvider,
        parserProvider: parsed.provider,
        parserModel: parsed.model,
        merchantName: parsed.merchantName ?? merchantHint,
        purchasedAt: parsed.purchasedAt,
        totalAmount: parsed.totalAmount ?? extractTotalFromRawText(rawText),
      });

      // Tarayan kişi dahil TÜM üyeler bilgilendirilir — excludeUserId
      // verilmiyor, çünkü kullanıcı ekrandan çıkmış/uygulamayı kapatmış
      // olabilir ve sonucu ancak bildirimle öğrenebilir.
      if (notifyHousehold) {
        await notifyHousehold({
          householdId: scan.householdId,
          type: NOTIFICATION_TYPES.RECEIPT_PROCESSED,
          context: { householdId: scan.householdId, scanId },
          dedupeKey: `receipt_processed:${scanId}`,
        });
      }

      // 0 ürün bulunduysa kullanıcı hiçbir değer almadı — kota iade edilir.
      if (lineItemsWithMatches.length === 0 && releaseAiUsage) {
        await releaseAiUsage({ refId: scanId });
      }

      return result;
    } catch (error) {
      if (releaseAiUsage) {
        await releaseAiUsage({ refId: scanId });
      }
      return receiptScanRepo.markFailed(scanId, error.message);
    }
  };
};

export { makeProcessReceiptScan, isNonProductLine };
