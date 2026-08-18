import { stripHomoglyphs } from './text-normalize.js';
import { findBrandInText, squash } from './turkish-brands.js';
import { ALL_CATEGORY_KEYS } from '../../domain/storage-suggestion.js';

// Modelden (Ollama/Gemini fark etmez) bağımsız, saf deterministik
// post-processing katmanı. Fiş ayrıştırma sağlayıcısı ne olursa olsun aynı
// kurallar uygulanmalı — bu dosya provider adaptörleri arasında paylaşılır.

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    merchantName: { type: ['string', 'null'] },
    purchasedAt: { type: ['string', 'null'] },
    totalAmount: { type: ['number', 'null'] },
    lineItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          rawText: { type: 'string' },
          parsedName: { type: 'string' },
          parsedCategory: { type: ['string', 'null'], enum: [...ALL_CATEGORY_KEYS, null] },
          parsedQuantity: { type: 'number' },
          parsedUnit: { type: 'string', enum: ['piece', 'gram', 'kilogram', 'milliliter', 'liter', 'package'] },
          parsedPrice: { type: ['number', 'null'] },
        },
        required: ['rawText', 'parsedName', 'parsedQuantity', 'parsedUnit'],
      },
    },
  },
  required: ['lineItems'],
};

const SYSTEM_PROMPT = `Sen bir Türk market fişini analiz eden bir asistansın.
Ham fiş metnindeki ürün satırlarını çıkar ve JSON şemasına uygun döndür.

KURALLAR:
1. MIKTAR UYDURMA. Satırda açıkça bir adet/miktar yazmıyorsa parsedQuantity = 1 yaz.
   Satır başında "2 X" veya "3 ADET" gibi bir çarpan varsa onu kullan.
2. BIRIM, ürün adındaki ölçüyle tutarlı olmalı:
   - "1LT", "2.5L" gibi hacim -> parsedUnit "liter", parsedQuantity = o sayı (1, 2.5)
   - "500G", "250 GR" gibi ağırlık -> parsedUnit "gram", parsedQuantity = o sayı (500, 250)
   - "1KG", "2 KG" -> parsedUnit "kilogram", parsedQuantity = o sayı
   - Sadece "KG" yazıyorsa (miktar belirsiz) -> parsedUnit "kilogram", parsedQuantity = 1
   - Ölçü yoksa -> parsedUnit "piece", parsedQuantity = 1
3. parsedName: kısaltmayı açık ve DOĞRU YAZILMIŞ Türkçe isme çevir; satırda bir
   marka/üretici adı varsa (özel isim, genelde İngilizce/yabancı köklü ya da
   tescilli görünür: "7DAYS", "MİLKTEN", "CP", "TODAY" gibi) AYNEN KORUYUP
   "Marka Ürün" biçiminde başa ekle — satırdaki sırası ne olursa olsun.
   MARKA İLE ÜRÜN TÜRÜNÜ KARIŞTIRMA: "kruvasan", "labne", "waffle", "kaymak",
   "sosis", "yoğurt", "ekmek" gibi kelimeler ÜRÜN TÜRÜDÜR, marka değildir.
   Ölçüyü isme tekrar ekleme, o zaten birimde var.
   Örnek: "DMS SUT 1LT" -> "DMS Süt", "MİLKTEN 300 G LABNE" -> "Milkten Labne",
   "KRUVASAN 55G7DAYS" -> "7Days Kruvasan" (DİKKAT: marka satırın SONUNDA,
   ürün türü BAŞINDA yazıyor), "EKMEK TAM BUGDAY" -> "Tam Buğday Ekmeği".
4. parsedCategory: ürünün kategorisini şu listeden seç (TAM OLARAK bu
   anahtarlardan biri): ${ALL_CATEGORY_KEYS.join(', ')}.
   Emin değilsen "other" değil, null bırak — yanlış kategori vermektense
   boş bırakmak daha iyi.
   Örnek: "Milkten Kaymak" -> "dairy", "Today Waffle" -> "bakery",
   "7Days Kruvasan" -> "bakery", "CP Sosis" -> "meat", "Ayran" -> "dairy".
5. merchantName: fişin en üstündeki mağaza/market adını yaz (örn. "MIGROS TICARET A.S.").
6. Ürün OLMAYAN satırları atla: TOPLAM, TOPKDV, KDV, TARIH, SAAT, FIS NO, KASIYER,
   TESEKKURLER, ARA TOPLAM, NAKIT, KREDI KARTI, POS, EFT, BANKA, SATIS,
   BELGE, MERSIS gibi satırlar ürün değildir. Sadece rakam/yüzde/tutardan
   oluşan satırlar da ürün değildir: "*9,90", "82,55", "%08" gibi tek
   başına fiyat/oran satırlarını asla ürün olarak döndürme.
7. parsedPrice: satırdaki fiyat (virgül ondalık ayracıdır: "32,50" -> 32.50).

Sadece JSON döndür, açıklama ekleme.`;

// Satırdaki ölçüyü (500G, 1LT, 2.5L, 1KG) yakalar. Model bu kuralı promptta
// verilmesine rağmen tutarsız uyguluyordu ("500G" -> 1 gram gibi), envanterin
// doğruluğu buna bağlı olduğu için deterministik olarak burada düzeltiyoruz.
const MEASUREMENT_PATTERN = /(\d+(?:[.,]\d+)?)\s*(KG|GR?|LT?|ML)\b/i;

const UNIT_BY_SUFFIX = {
  KG: 'kilogram',
  G: 'gram',
  GR: 'gram',
  L: 'liter',
  LT: 'liter',
  ML: 'milliliter',
};

const normalizeMeasurement = (item) => {
  const match = MEASUREMENT_PATTERN.exec(item.rawText ?? '');
  if (!match) return item;

  const amount = Number(match[1].replace(',', '.'));
  const unit = UNIT_BY_SUFFIX[match[2].toUpperCase()];
  if (!unit || !Number.isFinite(amount)) return item;

  // Satır başındaki çarpanı (örn. "2 X YUMURTA") koru: 2 paket x 500g.
  const multiplier = item.parsedQuantity > 1 && item.parsedUnit === 'piece' ? item.parsedQuantity : 1;

  return { ...item, parsedQuantity: amount * multiplier, parsedUnit: unit };
};

// Model toplam tutarı bazen atlıyor; fiş metninde açıkça yazdığı için
// yedek olarak buradan da okuyoruz.
const TOTAL_PATTERN = /^\s*(?:GENEL\s+)?TOPLAM\s*[:\s]\s*([\d.,]+)\s*$/im;

const extractTotalAmount = (rawText) => {
  const match = TOTAL_PATTERN.exec(rawText ?? '');
  if (!match) return null;
  const amount = Number(match[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(amount) ? amount : null;
};

// parsedName'e ölçü sızabiliyor ("Mangoana 200G Kızıltılayıcı" gibi) — kural
// 4'te "ölçüyü isme tekrar ekleme" denmesine rağmen model tutarsız. Ölçü
// zaten parsedUnit/parsedQuantity'de var, isimde tekrarına gerek yok.
const NAME_MEASUREMENT_PATTERN = /\b\d+(?:[.,]\d+)?\s*(KG|GR?|LT?|ML)\b/gi;

const stripMeasurementFromName = (name) =>
  (name ?? '').replace(NAME_MEASUREMENT_PATTERN, '').replace(/\s+/g, ' ').trim();

// Marka çözümü iki kademeli: önce sözlük (deterministik, otoriter — modelin
// kararını ezer), sonra modelin kendi tahmini ama halüsinasyon kalkanıyla:
// model bir marka uydurduysa ve o marka ham metinde hiç geçmiyorsa atılır.
// parsedBrand artık şemada yok (performans: model daha az token üretiyor) —
// marka çözümü tamamen sözlüğe (turkish-brands.js) dayanıyor. Sözlükte
// olmayan bir marka artık hiç yakalanmaz; bu durumda model yine de prompt
// kural 3 gereği markayı parsedName'e gömmeye çalışır (buildFinalName buna
// dokunmaz).
const resolveBrand = (item) => findBrandInText(item.rawText);

// Marka isimde HİÇ geçmiyorsa başa ekler ("Marka Ürün" biçimi, kural 4).
// "İçeriyor mu" kontrolü (sadece "başta mı" değil) kasıtlı: model bazen
// markayı sonda tekrar ediyor ("Xroll Çilek Xroll") — sadece başlangıcı
// kontrol etseydik bu satırların başına ikinci bir "Xroll" daha eklenirdi.
const buildFinalName = (rawName, brand) => {
  const cleaned = stripMeasurementFromName(stripHomoglyphs(rawName));
  if (!brand) return cleaned;
  const alreadyContainsBrand = squash(cleaned).includes(squash(brand));
  return alreadyContainsBrand ? cleaned : `${brand} ${cleaned}`.replace(/\s+/g, ' ').trim();
};

// Şema enum'u zaten kategori anahtarını kısıtlıyor ama savunma amaçlı
// ikinci bir kontrol — model şemayı çiğneyen bir değer döndürürse (bazı
// modellerde structured output %100 garantili değil) sessizce null'a düşer.
const resolveCategory = (item) => {
  const category = item.parsedCategory?.trim();
  return category && ALL_CATEGORY_KEYS.includes(category) ? category : null;
};

// Modelin ham çıktısını deterministik katmanlardan geçirir: ölçü düzeltmesi
// (mevcut), marka çözümü (sözlük + halüsinasyon kalkanı), isim temizliği
// (homoglif + ölçü tekrarı + marka öneki), kategori doğrulaması. Bkz. dosya
// başı yorum.
const finalizeItem = (item) => {
  const measured = normalizeMeasurement(item);
  const brand = resolveBrand(measured);
  return {
    ...measured,
    parsedBrand: brand,
    parsedName: buildFinalName(measured.parsedName, brand),
    parsedCategory: resolveCategory(measured),
  };
};

export {
  RESPONSE_SCHEMA,
  SYSTEM_PROMPT,
  finalizeItem,
  resolveBrand,
  buildFinalName,
  resolveCategory,
  extractTotalAmount,
  // Alias ön-eşleştirmesinde (process-receipt-scan) AI'a hiç gitmeyen
  // satırların miktar/birimini çıkarmak için de kullanılıyor.
  normalizeMeasurement,
};
