import { stripHomoglyphs } from './text-normalize.js';
import { findBrandInText, squash } from './turkish-brands.js';
import { categoryHintForBrand } from './brand-category-hints.js';
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
8. Kullanıcı mesajının başında "MARKET: X" satırı varsa bu fişin hangi
   zincirden geldiğini bilirsin. Zincire özgü kısaltmaları buna göre aç
   (örn. ŞOK fişlerinde "PYT" = "Piyale", MİGROS fişlerinde "M." ön eki
   Migros özel markasıdır). MARKET satırını ürün olarak döndürme. Emin
   değilsen MARKET bilgisini yoksay, yanlış tahmin etmektense atla.
9. BİTİŞİK/KISALTILMIŞ İSİMLERİ AÇARKEN UYDURMA. Fiş OCR'ı kelimeleri
   birbirine yapıştırabilir ("MANGOANA" gibi). Açarken YALNIZCA çok yaygın,
   tartışmasız ürün adlarını kullan ("MANGOANA" -> "Mango Ananas", bilinen
   bir Kızılay maden suyu aromasıdır; "Mango Suyu" DEĞİLDİR). Emin
   değilsen kısaltmayı AÇMADAN bırak — yanlış açılım, hiç açmamaktan daha
   kötüdür çünkü kullanıcıyı yanlış yönlendirir.
10. MARKA İÇECEK/MADEN SUYU MARKASIYSA ÜRÜNÜ İÇECEK OLARAK YORUMLA. Satırda
    bilinen bir içecek markası geçiyorsa (Kızılay, Uludağ, Erikli, Sırma,
    Beypazarı, Hamidiye, Coca-Cola, Fanta, Pepsi, Cappy, Dimes) parsedCategory
    "beverages" olmalı — "Kızılay Mango Ananas" bir MEYVE SUYU değil, aromalı
    MADEN SUYUDUR.
11. ÇOKLU PAKET SATIRLARI ("6X200ML", "4X1LT", "2 X 500G" gibi):
    parsedQuantity PAKET SAYISI olmalı (N), parsedUnit "piece" olmalı.
    N ile M'yi ASLA ÇARPMA. Örnek: "6X200ML" -> parsedQuantity=6,
    parsedUnit="piece" (parsedQuantity=1200, parsedUnit="milliliter" YANLIŞ).
    Birim soneki satırda kayıp/bitişikse ("6X200KIZTILAY" gibi ML hiç
    yazmıyor) yine parsedQuantity=6, parsedUnit="piece" yaz — hacim/ağırlık
    birimi UYDURMA.

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

// "NxM[BİRİM]" çoklu paket deseni: "6X200ML", "4X1LT", "2 X 500G" ve OCR'ın
// birim sonekini yuttuğu bitişik varyantlar ("MANGOANA6X200KIZTILAY" — burada
// ML hiç yazmıyor). Gerçek olay (2026-08-26): model bu deseni tutarsız
// yorumluyordu — aynı ham satır 8 taramada 1200 ml, 1 adet, 6 adet, 1 ml gibi
// 4 farklı sonuç üretti. Prompt düzeltmesi tek başına yetmiyor, bu yüzden
// deterministik bir katman gerekiyor.
//
// count (paket adedi) 2-99 aralığıyla sınırlı: tek paket ("1X500ML") çoklu
// paket DEĞİLDİR — bu durumda eski tek-ölçü davranışı (SUT 1LT -> 1 liter)
// aynen çalışmaya devam etmeli.
// (?<!\d)/(?!\d) demir noktaları: harfe bitişik eşleşmeyi bozmaz ("A6X200"),
// ama bir sayının ortasından yanlış parça koparmayı engeller.
const MULTIPACK_PATTERN = /(?<!\d)([2-9]|[1-9]\d)\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*(KG|GR?|LT?|ML)?(?!\d)/;

// Marka kategorisi bilindiğinde ve birim soneki OCR'da kaybolduğunda son
// çare: bu üç grup neredeyse istisnasız hacim/ml ile satılır (bkz.
// brand-category-hints.js'deki "sözlük modelin kararını ezer" felsefesi).
// Kapsam KASITLI DAR — gıda/bakkaliye gruplarında birim tahmini riskli.
const DEFAULT_PACK_UNIT_BY_CATEGORY = {
  beverages: 'milliliter',
  cleaning: 'milliliter',
  personal_care: 'milliliter',
};

// rawText'ten "N adet x M birim" çoklu paket bilgisini deterministik çıkarır.
// Dönüş: { count, size, unit } | null. unit çözülemezse null olabilir —
// çağıran taraf bu durumda packSize/packUnit'i boş bırakıp SADECE count'u
// (adet sayısını) kullanır; yanlış birim UYDURMAKTANSA eksik bırakmak
// tercih edilir (bkz. dosya başı "MİKTAR UYDURMA" ilkesi).
const parseMultipack = (rawText) => {
  const match = MULTIPACK_PATTERN.exec(rawText ?? '');
  if (!match) return null;

  const count = Number(match[1]);
  const size = Number(match[2].replace(',', '.'));
  if (!Number.isFinite(count) || count < 2 || count > 99) return null;
  if (!Number.isFinite(size) || size <= 0) return null;

  const suffix = match[3]?.toUpperCase();
  if (suffix) {
    const unit = UNIT_BY_SUFFIX[suffix];
    return unit ? { count, size, unit } : null;
  }

  // Birim soneki yok. Boyut 1000'i geçiyorsa muhtemelen yıl/kod bulaşması
  // ("12X2026" gibi), çoklu paket değil — reddet.
  if (size >= 1000) return null;

  return { count, size, unit: null };
};

// Birim soneki kaybolduğunda (parseMultipack unit=null döndürdüğünde) AI'ın
// kendi parsedUnit'i ölçülebilir bir birimse onu ipucu olarak kullan — AI
// genelde miktarı yanlış hesaplasa da (6*200=1200) birimi doğru veriyordu.
const MEASURABLE_UNITS = new Set(['gram', 'kilogram', 'milliliter', 'liter']);

const resolveMeasurableUnit = (unit) => (MEASURABLE_UNITS.has(unit) ? unit : null);

const normalizeMeasurement = (item) => {
  const multipack = parseMultipack(item.rawText);
  if (multipack) {
    // Çoklu paket: miktar PAKET SAYISI, birim 'piece'. Tek paketin boyutu
    // ayrı alanlarda taşınır — 6*200=1200 gibi bir çarpım ASLA yapılmaz.
    const packUnit = multipack.unit ?? resolveMeasurableUnit(item.parsedUnit);
    return {
      ...item,
      parsedQuantity: multipack.count,
      parsedUnit: 'piece',
      // Birim henüz çözülemese de boyutu (200 gibi) taşımaya devam ediyoruz
      // — finalizeItem marka kategorisi kademesinden sonra packUnit'i tekrar
      // çözmeyi dener ve o kademe de başarısız olursa ANCAK O ZAMAN boyutu
      // null'a düşürür (CHECK kısıtı: ikisi birlikte dolu/boş olmalı).
      parsedPackSize: multipack.size,
      parsedPackUnit: packUnit,
    };
  }

  const match = MEASUREMENT_PATTERN.exec(item.rawText ?? '');
  if (!match) return item;

  const amount = Number(match[1].replace(',', '.'));
  const unit = UNIT_BY_SUFFIX[match[2].toUpperCase()];
  if (!unit || !Number.isFinite(amount)) return item;

  return { ...item, parsedQuantity: amount, parsedUnit: unit };
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
  // Bazı marka grupları (içecek/temizlik/kişisel bakım) kategoriyi kesin
  // belirler — marka sözlüğü burada da AI'ın kararını EZER, sadece NULL'u
  // doldurmaz (bkz. brand-category-hints.js). "Kızılay" gibi bir maden suyu
  // markası, isim ne kadar bozuk çıkarsa çıksın ("Kızılay Mangoana") ürünü
  // her zaman beverages yapar.
  const brandCategory = categoryHintForBrand(brand);

  // Çoklu paket tespit edildiyse (normalizeMeasurement parsedPackSize/Unit
  // ürettiyse) ama birim hâlâ çözülemediyse, marka kategorisi bilindikten
  // SONRA son bir deneme yapılır — resolveBrand/categoryHintForBrand
  // normalizeMeasurement'tan sonra çalıştığı için bu kademe burada.
  let packSize = measured.parsedPackSize ?? null;
  let packUnit = measured.parsedPackUnit ?? null;
  if (packSize !== null && packUnit === null) {
    packUnit = DEFAULT_PACK_UNIT_BY_CATEGORY[brandCategory] ?? null;
    packSize = packUnit ? packSize : null;
  }

  return {
    ...measured,
    parsedBrand: brand,
    parsedName: buildFinalName(measured.parsedName, brand),
    parsedCategory: brandCategory ?? resolveCategory(measured),
    parsedPackSize: packSize,
    parsedPackUnit: packUnit,
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
  parseMultipack,
};
