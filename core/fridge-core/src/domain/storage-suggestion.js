// Fiş onay ekranında her ürünün hangi bölüme (buzdolabı/dondurucu/kiler)
// gideceğini önerir — kullanıcı tek tek seçmek zorunda kalmasın diye.
// Katmanlı: önce kategori (kesin sinyal), sonra ürün adındaki anahtar
// kelime (kategori yoksa/belirsizse yedek), hiçbiri tutmazsa null —
// kullanıcı kararı: belirsiz ürün asla varsayılana zorlanmaz, işaretlenir.

// product_category.key -> storage_location.kind. db-schemas/seed.js'teki
// 17 kategoriyle birebir eşleşir.
const CATEGORY_TO_STORAGE_KIND = {
  dairy: 'fridge',
  'dairy.milk': 'fridge',
  'dairy.cheese': 'fridge',
  'dairy.yogurt': 'fridge',
  meat: 'fridge',
  produce: 'fridge',
  frozen: 'freezer',
  pantry: 'pantry',
  'pantry.pasta': 'pantry',
  'pantry.canned': 'pantry',
  'pantry.condiments': 'pantry',
  bakery: 'pantry',
  beverages: 'pantry',
  snacks: 'pantry',
  cleaning: 'pantry',
  personal_care: 'pantry',
  // 'other' bilinçli olarak burada yok — belirsiz sayılsın, anahtar
  // kelime katmanına düşsün.
};

// db-schemas/seed.js'teki 17 kategori anahtarının tam listesi — AI'ın
// kategori tahminini doğrulamak için tek doğruluk kaynağı (bkz.
// line-item-finalizer.js RESPONSE_SCHEMA enum'u).
const ALL_CATEGORY_KEYS = [
  'dairy', 'dairy.milk', 'dairy.cheese', 'dairy.yogurt',
  'produce', 'meat', 'bakery',
  'pantry', 'pantry.pasta', 'pantry.canned', 'pantry.condiments',
  'beverages', 'frozen', 'cleaning', 'personal_care', 'snacks', 'other',
];

// Kategori boşsa/eşleşmezse ürün adına bakan güvenlik ağı. Sıra önemli:
// daha spesifik kelimeler (örn. "dondurma") daha genel olanlardan önce
// gelmeli ki "dondurulmuş süt" gibi bir şey yanlış bölüme gitmesin.
// Türkçe ünsüz yumuşaması (yoğur[t/d]-, kayma[k/ğ]-) çekim ekiyle kelime
// kökünü bozuyor ("yoğurt" -> "yoğurdu", "kaymak" -> "kaymağı") — kökü
// sabitleyip son ünsüzü [td]/[kğ] olarak esnetiyoruz ki çekimli hallerde de
// eşleşsin.
const KEYWORD_RULES = [
  { pattern: /dondurma|donmuş|dondurulmuş/i, kind: 'freezer' },
  { pattern: /süt|yoğur[td]|peynir|kayma[kğ]|labne|ayran|krema|tereyağ|yumurta|sosis|salam|sucuk|jambon|et\b|tavuk|balık/i, kind: 'fridge' },
  { pattern: /makarna|pirinç|bulgur|un\b|şeker|tuz|cips|kraker|bisküvi|çikolata|deterjan|şampuan|sabun|çay|kahve|konserve/i, kind: 'pantry' },
];

// { categoryKey, productName } -> 'fridge' | 'freezer' | 'pantry' | null
const suggestStorageKind = ({ categoryKey, productName }) => {
  if (categoryKey && CATEGORY_TO_STORAGE_KIND[categoryKey]) {
    return CATEGORY_TO_STORAGE_KIND[categoryKey];
  }

  const name = productName ?? '';
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(name)) return rule.kind;
  }

  return null;
};

export { CATEGORY_TO_STORAGE_KIND, KEYWORD_RULES, ALL_CATEGORY_KEYS, suggestStorageKind };
