// Yaygın Türk market zincirleri — fişin ham metninden mağaza adını
// deterministik çıkarmak için kullanılır. AI'ın merchantName alanı
// alias-only eşleştirme yolunda hiç çağrılmadığı için boş kalabiliyor
// (bkz. process-receipt-scan.use-case.js); bu liste o boşluğu dolduran
// bir yedek/fallback, AI'ın yerini almıyor.
import { squash, levenshtein } from './turkish-brands.js';

const TURKISH_MERCHANTS = [
  'Migros', 'Şok', 'BİM', 'A101', 'Carrefour', 'CarrefourSA', 'Macrocenter',
  'Metro', 'Bizim Toptan', 'Hakmar', 'Onur Market', 'Tarım Kredi', 'Getir',
  'İstegelsin',
];

const SQUASHED_MERCHANTS = TURKISH_MERCHANTS
  .map((merchant) => ({ merchant, squashed: squash(merchant) }))
  .sort((a, b) => b.squashed.length - a.squashed.length);

// Fişin üst kısmında (market adı genelde ilk satırlarda yer alır) bulanık
// arama yapar; bulunamazsa tüm metinde dener. turkish-brands.js'teki
// findBrandInText ile aynı eşik mantığı: kısa isimler (<6) sadece tam alt
// dize, uzun isimler bulanık (Levenshtein) eşleşme.
const searchMerchantIn = (text) => {
  const squashedText = squash(text);
  if (!squashedText) return null;

  for (const { merchant, squashed } of SQUASHED_MERCHANTS) {
    if (squashed.length < 2) continue;
    if (squashedText.includes(squashed)) return merchant;
  }

  let best = null;
  let bestDistance = Infinity;
  for (const { merchant, squashed } of SQUASHED_MERCHANTS) {
    if (squashed.length < 6) continue;
    const maxDistance = squashed.length >= 8 ? 2 : 1;
    for (let len = squashed.length - 1; len <= squashed.length + 1; len += 1) {
      for (let start = 0; start <= squashedText.length - len; start += 1) {
        const window = squashedText.slice(start, start + len);
        const distance = levenshtein(window, squashed);
        if (distance <= maxDistance && distance < bestDistance) {
          bestDistance = distance;
          best = merchant;
        }
      }
    }
  }
  return best;
};

const extractMerchantFromRawText = (rawText) => {
  if (!rawText) return null;
  const lines = rawText.split('\n').filter((line) => line.trim().length > 0);
  const headLines = lines.slice(0, 5).join('\n');

  return searchMerchantIn(headLines) ?? searchMerchantIn(rawText);
};

export { TURKISH_MERCHANTS, extractMerchantFromRawText };
