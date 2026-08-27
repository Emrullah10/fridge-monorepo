// Bir envanter kaleminin AI tarif üretimine hangi rolde gireceğini belirler.
// Saf iş kuralı, Gemini'ye bağlı değil — "Kızılay Mango Ananas Maden Suyu"
// gibi bir içeceğin tatlı tarifinin çekirdeği olmasını, ya da bir deterjanın
// malzeme listesine girmesini önlemek için.

// Tarife ASLA girmez.
const EXCLUDED_CATEGORIES = new Set(['cleaning', 'personal_care']);

// Tarife girer ama ayrı bir blokta, "yalnızca sıvı/kabartıcı rolde" kısıtıyla
// — tamamen elemek yanlış olur (ayran, meyve suyu tarifte kullanılır; süt
// yanlış kategorize edilmişse kaybolur), serbest bırakmak da yanlış olur
// (maden suyu bir tatlının lezzet çekirdeği olamaz).
const BEVERAGE_CATEGORIES = new Set(['beverages']);

// categoryId null (kategori bilinmiyor) -> 'ingredient' kovasına düşer,
// eleme yapılmaz; recipe-prompt.js bunu "[kategori bilinmiyor]" olarak
// işaretler, AI'ın kendi muhakemesine bırakılır.
const classifyForRecipe = (item) => {
  const categoryId = item?.categoryId ?? null;
  if (EXCLUDED_CATEGORIES.has(categoryId)) return 'excluded';
  if (BEVERAGE_CATEGORIES.has(categoryId)) return 'beverage';
  return 'ingredient';
};

export { EXCLUDED_CATEGORIES, BEVERAGE_CATEGORIES, classifyForRecipe };
