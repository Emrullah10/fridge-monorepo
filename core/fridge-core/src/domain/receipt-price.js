// Fiş satırlarına fiyat ekleme — saf domain modülü, ingredient-match.js/
// nutrition.js deseni. Mobil OCR (ML Kit) fiyatı çoğu zaman ürün adıyla AYNI
// satırda değil, ayrı bir satırda veriyor ("*9,90"), çünkü fiş sağa hizalı
// tutar sütunu ile sola hizalı ürün sütununu iki ayrı TextLine olarak
// tanıyor. process-receipt-scan.use-case.js'teki AMOUNT_ONLY_LINE_PATTERN
// filtresi bu satırları modele gitmeden ÖNCE siliyordu — bu yüzden
// parsedPrice hem alias yolunda (hiç hesaplanmıyordu) hem AI yolunda (model
// fiyatsız metin görüyor) hep null geliyordu. Bu modül filtre uygulanmadan
// ÖNCE ham satırlara bakıp fiyatı komşu satırlardan çıkarır.
import { isAmountOnlyLine, isFooterKeywordLine } from './receipt-line-filter.js';

// TR fiş biçimi: virgül ondalık ayracı, nokta binlik ayracı.
// "*9,90" -> 9.9, "1.234,56" -> 1234.56, "82,55 TL" -> 82.55
const parseAmountToken = (text) => {
  const trimmed = (text ?? '').trim();
  const match = /^\*?\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(TL)?\s*$/i.exec(trimmed);
  if (!match) return null;
  const normalized = match[1].replace(/\./g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
};

// Fiyat aynı satırda ürün adıyla birlikte gelmiş olabilir ("EKMEK *9,90") —
// bu durumda satır sondaki tutarı kaybetmeden ikiye ayrılır. `text` alias
// aramasında kullanılacağı için (product_alias.raw_text anahtarları bu
// metinle öğrenildi), sadece sondaki tutar token'ı ayrılır, satırın geri
// kalanı DEĞİŞTİRİLMEZ.
const TRAILING_AMOUNT_PATTERN = /^(.*\S)\s+(\*?\s*\d{1,3}(?:\.\d{3})*(?:,\d+)?|\*?\s*\d+(?:,\d+)?)\s*(TL)?\s*$/i;

const splitTrailingAmount = (line) => {
  const trimmed = (line ?? '').trim();
  const match = TRAILING_AMOUNT_PATTERN.exec(trimmed);
  if (!match) return { text: trimmed, price: null };
  const price = parseAmountToken(match[2]);
  if (price === null) return { text: trimmed, price: null };
  return { text: match[1].trim(), price };
};

// "2 X 16,25" gibi çarpım/birim-fiyat satırları — bunlar satır TOPLAMI
// değil, birim fiyat ipucudur. Fiyat olarak ALINMAZ (satır toplamı ayrı
// bir satırda ayrıca gelir); burada sadece "bu satır fiyat değil, atla"
// kararı için kullanılır.
const MULTIPLIER_HINT_PATTERN = /^\d+\s*[xX]\s*\d+([.,]\d+)?\s*$/;

// Ham fiş satırlarını (henüz isNonProductLine filtrelenmemiş) tarar, her
// ürün adayı satırdan sonra gelen "ürün olmayan" satırlardaki tutarları o
// ürünün satır toplamı olarak eşler. Fiş altbilgisine (TOPLAM/KDV/NAKIT...)
// gelince tarama durur — altbilgideki tutarlar ürün fiyatı değildir.
//
// Dönen `takePrice(text)` bir KUYRUKTAN okur: birebir aynı metne sahip iki
// gerçek satır (aynı üründen 2 kalem, farklı fiyatlı olabilir) farklı fiyat
// alabilsin diye Map<string, number[]> + shift() kullanılır — use-case'teki
// orderOf Map'inin aynı-metin çakışma davranışını fiyat tarafında tekrarlama.
const attachPrices = (rawLines, isNonProductLine) => {
  const priceQueue = new Map();
  const pushPrice = (key, price) => {
    if (!priceQueue.has(key)) priceQueue.set(key, []);
    priceQueue.get(key).push(price);
  };

  let stopped = false;
  for (let i = 0; i < rawLines.length; i += 1) {
    const raw = rawLines[i];
    if (stopped) break;
    if (isFooterKeywordLine(raw)) {
      stopped = true;
      break;
    }
    if (isNonProductLine(raw)) continue; // ürün adayı değil, çapa olamaz

    const { text: candidateText, price: sameLinePrice } = splitTrailingAmount(raw);
    if (sameLinePrice !== null) {
      pushPrice(candidateText, sameLinePrice);
      continue;
    }

    // Bu satır bir ürün adayı ama fiyat aynı satırda değil — sonraki
    // "ürün olmayan" satırları tara, altbilgiye veya bir sonraki ürün
    // adayına kadar. Bulunan tutarların SONUNCUSU satır toplamı sayılır
    // (TR fişlerinde önce birim fiyat/KDV oranı, sonra satır toplamı gelir).
    let lastAmount = null;
    let j = i + 1;
    while (j < rawLines.length) {
      const next = rawLines[j];
      const trimmedNext = next.trim();
      if (isFooterKeywordLine(next)) break;
      const isMultiplierHint = MULTIPLIER_HINT_PATTERN.test(trimmedNext);
      // "2 X 16,25" gibi bir çarpım ipucu harf (X) içerdiği için
      // isNonProductLine false dönebilir — bir sonraki ürün adayı sanılıp
      // tarama burada durmasın diye önce çarpım ipucu kontrolü yapılır.
      if (!isMultiplierHint && !isNonProductLine(next)) break; // bir sonraki ürün adayına gelindi
      if (!isMultiplierHint) {
        const amount = parseAmountToken(trimmedNext);
        if (amount !== null) lastAmount = amount;
      }
      j += 1;
    }
    if (lastAmount !== null) pushPrice(candidateText, lastAmount);
  }

  const takePrice = (text) => {
    const key = (text ?? '').trim();
    const queue = priceQueue.get(key);
    if (!queue || queue.length === 0) return null;
    return queue.shift();
  };

  return { takePrice };
};

export { parseAmountToken, splitTrailingAmount, attachPrices };
