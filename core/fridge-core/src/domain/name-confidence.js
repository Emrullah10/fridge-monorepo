// Fişten gelip AI tarafından hatalı ayrıştırılmış, bitişik/kesik ürün
// adlarını ("MANGOANA" gibi — aslında "Mango Ananas") tespit eder. Amaç
// bu isimleri tarif üretiminde ana malzeme olmaktan alıkoymak (bkz.
// recipe-prompt.js "?" işareti) ve fiş onay ekranında düşük güven
// rozetiyle kullanıcıya doğrulatmak.
//
// Kasıtlı olarak muhafazakâr: yanlış negatif (kaçırılan şüpheli isim),
// yanlış pozitiften (kullanıcıyı gereksiz uyaran) daha az zararlı. Bu
// yüzden kullanıcı ya da seed kaynaklı ürünler (productSource !== 'ai_generated')
// hiç kontrol edilmez — "Domates" gibi kısa, tek kelimelik gerçek ürün
// adlarının yanlış yakalanmasını önler.

const THREE_CONSONANTS_PATTERN = /[bcçdfgğhjklmnprsştvyz]{3,}/i;

// Bilinen marka buildFinalName tarafından isme başa eklenmiş olabilir
// ("Kızılay Mangoana") — kontrolden ÖNCE sıyrılmazsa "iki kelime" sayılıp
// asıl şüpheli gövde ("Mangoana") hiç yakalanmaz. brand primitif bir
// parametre olarak geliyor: bu dosya (domain katmanı) infrastructure'a
// (turkish-brands.js) import bağımlılığı KURMAZ — çağıran taraf zaten
// product.brand'i elinde tutuyor (bkz. generate-ai-recipes.use-case.js).
const stripKnownBrand = (name, brand) => {
  if (!brand) return name;
  const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}\\s+`, 'i');
  const stripped = name.replace(pattern, '').trim();
  return stripped || name;
};

const isUncertainProductName = (name, { productSource, brand } = {}) => {
  if (productSource && productSource !== 'ai_generated') return false;

  const trimmed = (name ?? '').trim();
  if (!trimmed) return false;
  // 1-2 karakter bir ürün adı olamaz ("Süt" gibi 3 harfli gerçek kelimeler
  // burada elenmemeli, o yüzden eşik <=2).
  if (trimmed.length <= 2) return true;

  // Markayı sıyırdıktan sonra kalan gövdeye bak: "Kızılay Mangoana" ->
  // "Mangoana" (tek kelime, 8 karakter) -> şüpheli. "Kızılay Mango Ananas
  // Maden Suyu" -> "Mango Ananas Maden Suyu" (4 kelime) -> şüpheli değil.
  const body = stripKnownBrand(trimmed, brand);

  // Eşik 8: "MANGOANA" (8) yakalanır, "Domates"/"Salatalık" gibi gerçek
  // tek kelimelik ürün adları (yaygın olarak <=7) yanlış pozitif olmaz.
  const isSingleWord = !body.includes(' ');
  if (isSingleWord && body.length >= 8) return true;

  if (THREE_CONSONANTS_PATTERN.test(body)) return true;

  return false;
};

export { isUncertainProductName };
