// Bazı marka grupları istisnasıza yakın TEK bir kategoriye girer (bir maden
// suyu markası asla süt ürünü satmaz). Bu markalarda kategori kararını AI'ın
// olası hatasından çok markanın kendisine bağlıyoruz — resolveBrand'daki
// "sözlük modelin kararını ezer" felsefesiyle aynı (bkz. line-item-finalizer.js
// dosya başı yorumu).
//
// KASITLI DAR KAPSAM: sadece recipe-eligibility.js'nin özel davrandığı üç grup
// (beverages/cleaning/personal_care). Ülker gibi hem bakery hem snacks üreten
// gıda markaları BİLEREK dışarıda — yanlış pozitif riski kazançtan yüksek olurdu.
const BRAND_CATEGORY_HINTS = new Map([
  // İçecek / maden suyu
  ['Kızılay', 'beverages'], ['Uludağ', 'beverages'], ['Erikli', 'beverages'],
  ['Sırma', 'beverages'], ['Beypazarı', 'beverages'], ['Hamidiye', 'beverages'],
  ['Damla', 'beverages'], ['Coca-Cola', 'beverages'], ['Coca Cola', 'beverages'],
  ['Pepsi', 'beverages'], ['Fanta', 'beverages'], ['Sprite', 'beverages'],
  ['Fuse Tea', 'beverages'], ['Lipton', 'beverages'], ['Çaykur', 'beverages'],
  ['Doğadan', 'beverages'], ['Nescafe', 'beverages'], ['Aquafina', 'beverages'],
  ['Cappy', 'beverages'], ['Dimes', 'beverages'], ['Tamek', 'beverages'],
  // Temizlik
  ['Selpak', 'cleaning'], ['Papia', 'cleaning'], ['Solo', 'cleaning'],
  ['Fairy', 'cleaning'], ['Domestos', 'cleaning'], ['Cif', 'cleaning'],
  ['Omo', 'cleaning'], ['Ariel', 'cleaning'], ['Persil', 'cleaning'],
  ['Yumoş', 'cleaning'], ['Vernel', 'cleaning'], ['Bingo', 'cleaning'], ['Alo', 'cleaning'],
  // Kişisel bakım
  ['Elidor', 'personal_care'], ['Pantene', 'personal_care'], ['Dove', 'personal_care'],
  ['Nivea', 'personal_care'], ['Colgate', 'personal_care'], ['Signal', 'personal_care'],
  ['İpana', 'personal_care'], ['Molfix', 'personal_care'], ['Prima', 'personal_care'],
  ['Sleepy', 'personal_care'], ['Rexona', 'personal_care'], ['Axe', 'personal_care'],
  ['Head Shoulders', 'personal_care'], ['Clear', 'personal_care'],
]);

const categoryHintForBrand = (brand) => (brand ? BRAND_CATEGORY_HINTS.get(brand) ?? null : null);

export { BRAND_CATEGORY_HINTS, categoryHintForBrand };
