import { normalizeMeasurement } from '../../../infrastructure/parser/line-item-finalizer.js';

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

// Fişte HER satır bir ürün değil (tarih, saat, TOPLAM, KDV, kasiyer no,
// salt fiyat/tutar satırları...). Prompt kural 6'daki aynı liste. Bu
// satırlar alias aramasına hiç girmiyor (zaten hiçbir ürüne eşleşmezler)
// — ön-eşleştirmenin "kaçtı" sayması hatalıydı: tüm ürünler alias'tan
// geldiği bir taramada bile bu satırlar tek başına AI'ı tetikleyip asıl
// hız kazancını sıfırlıyordu.
//
// Gerçek gözlem (2026-08-18): eski desen "*9,90", "82,55" gibi salt fiyat
// satırlarını ve "ARATOP"/"TOPKDY"/"TOPLAN" gibi OCR/kısaltma varyantlarını
// kaçırıyordu — bu satırlar AI'a gidip "Unknown"/"Aratop" gibi çöp ürünler
// olarak üretiliyor, sonra alias'a yazılıp kalıcı hale geliyordu (bkz.
// product-alias.repository.js'deki ikinci savunma hattı). Tek regex yerine
// üç ayrı, test edilebilir kurala bölündü.
const DATE_LINE_PATTERN = /^\d{1,2}[./]\d{1,2}[./]\d{2,4}/;

// Satırın tamamı fiyat/tutar/oran gibi görünüyorsa (yıldızlı veya değil,
// TL sonekli veya değil) — bir ürün asla sadece rakam+ayraçtan ibaret
// olamaz. "*9,90", "82,55", "6,11", "*82,55 TL", "%08" hepsi bu kural.
const AMOUNT_ONLY_LINE_PATTERN = /^\*?\s*%?\s*\d+([.,]\d+)?\s*(TL)?\s*$/i;

// Bilinen fiş anahtar kelimeleri — OCR toleransı için sondaki \b yerine
// önek eşleşmesi kullanılır ("TOPLAM" -> "TOPLAN"/"TOPLAM." gibi son harf
// bozulmalarını da yakalar). Gerçek fişte görülen kısaltmalar dahil.
const KEYWORD_LINE_PATTERN =
  /^(SAAT|TOPLA[MN]|TOPKD[VY]|ARA\s*TOPLA[MN]|ARATOP|GENEL\s*TOPLA[MN]|KDV|TARI[Hİ]|FI[SŞ]\s*NO|KASIYER|TESEKKURLER|TEŞEKKÜRLER|NAKIT|KREDI\s*KART|K\.?\s*KARTI|POS|EFT|BANKA|SATIS|SATIŞ|BELGE|MERSIS|V\.?D\.?)/i;

// "X08" gibi tek harf + rakamdan oluşan kısa kodlar (KDV oranı simgesinin
// OCR'da % yerine X okunmuş hali gibi) — gerçek ürün adları en az bir
// gerçek kelime içerir, tek harf + rakam ürün adı olamaz.
const SINGLE_LETTER_CODE_PATTERN = /^[a-zçğıöşü]\s*\d+$/i;

const isNonProductLine = (line) => {
  const trimmed = (line ?? '').trim();
  if (!trimmed) return true;
  // Harf (Türkçe dahil) içermeyen satır bir ürün olamaz — salt sayı,
  // yüzde, sembol satırlarının hepsini kapsar.
  if (!/[a-zçğıöşüA-ZÇĞİÖŞÜ]/.test(trimmed)) return true;
  if (trimmed.length < 3) return true;
  return (
    DATE_LINE_PATTERN.test(trimmed) ||
    AMOUNT_ONLY_LINE_PATTERN.test(trimmed) ||
    KEYWORD_LINE_PATTERN.test(trimmed) ||
    SINGLE_LETTER_CODE_PATTERN.test(trimmed)
  );
};

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

  const matchProduct = async ({ householdId, rawText, parsedName, parsedBrand, parsedCategory, parsedUnit }) => {
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
    });
    await productAliasRepo.upsertUserCorrection({ householdId, rawText, productId: created.id, source: 'model' });
    return { matchedProductId: created.id, confidence: null, matchMethod: 'model' };
  };

  // Sözlükte eşleşen satır için AI'a gerek yok: ürün adı/kategorisi zaten
  // eşleşen üründe hazır, miktar/birim de ham metinden deterministik
  // çıkarılıyor (normalizeMeasurement, AI çıktısına da uygulanan aynı regex).
  const buildLineFromMatchedProduct = async ({ rawText, match }) => {
    const product = await productRepo.findById(match.matchedProductId);
    const measured = normalizeMeasurement({
      rawText,
      parsedQuantity: 1,
      parsedUnit: product?.defaultUnit ?? 'piece',
    });
    return {
      rawText,
      parsedName: product?.canonicalName ?? rawText,
      parsedBrand: product?.brand ?? null,
      parsedQuantity: measured.parsedQuantity,
      parsedUnit: measured.parsedUnit,
      parsedPrice: null,
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
      const candidateLines = rawLines.filter((line) => !isNonProductLine(line));
      const resolvedLines = [];
      const unmatchedLines = [];
      for (const line of candidateLines) {
        const match = await matchKnownProduct({ householdId: scan.householdId, rawText: line });
        if (match) {
          resolvedLines.push(await buildLineFromMatchedProduct({ rawText: line, match }));
        } else {
          unmatchedLines.push(line);
        }
      }

      // 2) Sadece tanınmayan satırlar modele gider. Hepsi tanındıysa AI parser
      //    hiç çağrılmaz — asıl hız kazancı burada.
      const parsed = unmatchedLines.length > 0
        ? await receiptParserPort.parse({ rawText: unmatchedLines.join('\n') })
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
        });
        aiLines.push({
          rawText: line.rawText,
          parsedName: line.parsedName,
          parsedBrand: line.parsedBrand ?? null,
          parsedQuantity: line.parsedQuantity,
          parsedUnit: line.parsedUnit,
          parsedPrice: line.parsedPrice ?? null,
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

      return receiptScanRepo.markReviewPending(scanId, {
        rawText,
        ocrProvider,
        parserProvider: parsed.provider,
        parserModel: parsed.model,
        merchantName: parsed.merchantName,
        purchasedAt: parsed.purchasedAt,
        totalAmount: parsed.totalAmount ?? extractTotalFromRawText(rawText),
      });
    } catch (error) {
      return receiptScanRepo.markFailed(scanId, error.message);
    }
  };
};

export { makeProcessReceiptScan, isNonProductLine };
