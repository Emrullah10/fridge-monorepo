// Fişte HER satır bir ürün değil (tarih, saat, TOPLAM, KDV, kasiyer no, salt
// fiyat/tutar satırları...). Saf domain modülü — application ve infrastructure
// katmanlarının (process-receipt-scan.use-case.js, receipt-price.js,
// line-item-finalizer.js prompt kural 6) TEK doğruluk kaynağı olsun diye
// buraya taşındı; önceden use-case içinde tekrarlanıyordu.

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

// Bir satır salt tutar mı (fiyat çıkarımında kullanılır, isNonProductLine'dan
// daha dar — anahtar kelime satırları burada "tutar" sayılmaz, sadece rakam
// satırları).
const isAmountOnlyLine = (line) => AMOUNT_ONLY_LINE_PATTERN.test((line ?? '').trim());

// Fiş altbilgisinin başladığını gösteren satır (TOPLAM/KDV/NAKIT vb.) —
// fiyat eşleme bu noktadan sonra durmalı, altbilgideki tutarlar ürün
// fiyatı değildir.
const isFooterKeywordLine = (line) => KEYWORD_LINE_PATTERN.test((line ?? '').trim());

export { isNonProductLine, isAmountOnlyLine, isFooterKeywordLine, AMOUNT_ONLY_LINE_PATTERN, KEYWORD_LINE_PATTERN };
