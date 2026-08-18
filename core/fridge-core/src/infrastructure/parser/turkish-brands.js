// Yaygın Türk market markaları — modelin marka/ürün türü kararını doğrulamak
// için kullanılır. Kapsamlı olması gerekmiyor (yeni markalar zamanla kullanıcı
// düzeltmeleriyle öğrenilir, bkz. correct-line-item.use-case.js), amaç en sık
// karşılaşılan ~150-200 marka için modelin hatasını deterministik yakalamak.
const TURKISH_BRANDS = [
  // Süt / süt ürünleri
  'Sütaş', 'Pınar', 'İçim', 'Sek', 'Danone', 'Activia', 'Milkten', 'Eker',
  'Muratbey', 'Yörsan', 'Ekol', 'Enka', 'Akhisar', 'Tikveşli', 'Sarıyer',
  'Birşah',
  // Et / şarküteri
  'Namet', 'Aytaç', 'Maret', 'Banvit', 'CP', 'Erpiliç', 'Beypiliç', 'Şenpiliç',
  'Bolulu', 'Pınar Et',
  // Fırın / atıştırmalık
  '7Days', 'Today', 'Xroll', 'Halley', 'Albeni', 'Dankek', 'Eti', 'Ülker',
  'Torku', 'Şölen', 'Nestle', 'Milka', 'Loacker', 'Nutella',
  // Cips / kraker
  'Lays', 'Ruffles', 'Doritos', 'Cheetos', 'Patos', 'Tadım', 'Peyman', 'Çerezza',
  // İçecek
  'Coca-Cola', 'Coca Cola', 'Pepsi', 'Fanta', 'Sprite', 'Fuse Tea', 'Lipton',
  'Çaykur', 'Doğadan', 'Nescafe', 'Uludağ', 'Kızılay', 'Erikli', 'Sırma',
  'Beypazarı', 'Hamidiye', 'Damla', 'Aquafina', 'Cappy', 'Dimes', 'Tamek',
  // Temel gıda / bakliyat / yağ
  'Yudum', 'Orkide', 'Komili', 'Tat', 'Tukaş', 'Reis', 'Yayla', 'Filiz',
  'Piyale', 'Barilla', 'Balparmak', 'Kristal', 'Anadolu', 'Bizim', 'Duru',
  'Sırma Yağ', 'Kavaklıdere',
  // Temizlik
  'Selpak', 'Papia', 'Solo', 'Fairy', 'Domestos', 'Cif', 'Omo', 'Ariel',
  'Persil', 'Yumoş', 'Vernel', 'Bingo', 'Alo',
  // Kişisel bakım
  'Elidor', 'Pantene', 'Dove', 'Nivea', 'Colgate', 'Signal', 'İpana',
  'Molfix', 'Prima', 'Sleepy', 'Rexona', 'Axe', 'Head Shoulders', 'Clear',
];

// Karşılaştırma için Türkçe büyük/küçük harf duyarlı normalize + boşluk/nokta
// temizliği: "7Days" ve ham metindeki "7DAYS" veya "55G7DAYS" içindeki
// "7DAYS" aynı şekle gelsin diye.
const squash = (text) =>
  (text ?? '')
    .toLocaleUpperCase('tr-TR')
    .replace(/[İI]/g, 'I')
    .replace(/[^A-Z0-9ĞÜŞÖÇ]/g, '');

// Uzunluğa göre azalan sırayla: alt dize taramasında en spesifik marka önce
// denensin ("Pınar Et", "Pınar"dan; "Coca-Cola", kısa bir eşleşmeden önce).
const SQUASHED_BRANDS = TURKISH_BRANDS
  .map((brand) => ({ brand, squashed: squash(brand) }))
  .sort((a, b) => b.squashed.length - a.squashed.length);

// Kısa markalarda (<5 karakter) çıplak alt dize eşleşmesi çok fazla yanlış
// pozitif üretiyor ("Sek" -> ŞEKER/EKSEK, "CP" -> herhangi "...CP...", "Tat"
// -> PATATES/SALATA/TATLI). Bu markalar için ham metni token'lara bölüp tam
// token eşitliği arıyoruz.
const SHORT_BRAND_LENGTH_THRESHOLD = 5;

const tokenizeSquashed = (rawText) =>
  (rawText ?? '')
    .split(/[^A-Za-zİıĞğÜüŞşÖöÇç0-9]+/)
    .map((token) => squash(token))
    .filter(Boolean);

// Basit Levenshtein — OCR bozukluğuyla gelen "KIZTILAY" gibi varyantları
// gerçek markaya ("KIZILAY") bağlamak için. Marka listesi küçük olduğundan
// (~150 kayıt) performans sorun değil.
const levenshtein = (a, b) => {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)]);
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[rows - 1][cols - 1];
};

// Fiş satırındaki ham metinde bilinen bir marka arar. Önce tam alt dize
// (hızlı, kesin), sonra bulanık (OCR hatalarını tolere eder). Tam eşleşme
// varsa onu döner; yoksa en yakın bulanık adayı (mesafe <= 2) döner.
const findBrandInText = (rawText) => {
  const squashedText = squash(rawText);
  if (!squashedText) return null;

  const tokens = tokenizeSquashed(rawText);

  for (const { brand, squashed } of SQUASHED_BRANDS) {
    if (squashed.length < 2) continue;

    if (squashed.length < SHORT_BRAND_LENGTH_THRESHOLD) {
      // Kısa marka: sadece tam token eşleşmesi kabul edilir.
      if (tokens.includes(squashed)) return brand;
      continue;
    }

    // Uzun marka: alt dize eşleşmesi kabul edilir, ama eşleşmenin hemen
    // öncesinde bir harf varsa (marka başka bir kelimenin ortasından
    // çıkıyorsa) reddedilir. Rakamla başlayan markalar ("7Days") ölçü
    // birimine bitişik gelebildiği için ("55G7DAYS") bu kontrolden muaf.
    const index = squashedText.indexOf(squashed);
    if (index === -1) continue;
    const precedingChar = index > 0 ? squashedText[index - 1] : '';
    const brandStartsWithDigit = /^[0-9]/.test(squashed);
    if (!brandStartsWithDigit && precedingChar && /[A-ZĞÜŞÖÇ]/.test(precedingChar)) continue;
    return brand;
  }

  // Bulanık arama: OCR'da ayraçlar (boşluk/nokta) da kaybolabildiği için
  // ("MANGOANA6X200KIZTILAY" tek bir bitişik blok) token'lara bölmek yerine
  // markanın uzunluğunda bir pencereyi metin boyunca kaydırıp her pozisyonda
  // edit distance ölçüyoruz. ~200 marka x ~30 karakterlik satır için ucuz.
  //
  // Kısa markalarda (<6 karakter, "Lays", "Eker" gibi) bulanık arama kapalı:
  // 4-5 karakterlik bir dizi neredeyse her rastgele metinde mesafe<=1 ile
  // "bulunur" ("EKMEK" -> "Eker", "AYRAN" -> "Aytaç" gibi yanlış pozitifler
  // gözlendi) — kısa markalar sadece tam alt dize eşleşmesiyle (yukarıdaki
  // döngü) yakalanır. Uzunlukla orantılı eşik de aynı nedenle: uzun markada
  // 2 harflik OCR hatası hâlâ güvenli bir sinyal, kısa markada değil.
  let best = null;
  let bestDistance = Infinity;
  for (const { brand, squashed } of SQUASHED_BRANDS) {
    if (squashed.length < 6) continue;
    const maxDistance = squashed.length >= 8 ? 2 : 1;
    for (let len = squashed.length - 1; len <= squashed.length + 1; len += 1) {
      for (let start = 0; start <= squashedText.length - len; start += 1) {
        const window = squashedText.slice(start, start + len);
        const distance = levenshtein(window, squashed);
        if (distance <= maxDistance && distance < bestDistance) {
          bestDistance = distance;
          best = brand;
        }
      }
    }
  }
  return best;
};

export { TURKISH_BRANDS, findBrandInText, squash, levenshtein };
