// Bir tarifin malzemelerini household envanteriyle karşılaştırır. Hem
// suggestions listelemesi hem "eksikleri alışveriş listesine ekle" hem de
// tarif detay ekranı AYNI sonucu vermeli — bu yüzden mantık tek yerde.
//
// Üç durum var, ikili (var/yok) değil: birim uyuşmazlığında miktarları
// dönüştürmeden karşılaştırmak veri bozar (cook-recipe.use-case.js'teki
// felsefeyle aynı) — böyle bir malzeme "unit_mismatch" olarak işaretlenir,
// ne "var" ne "yok" sayılır.
const matchIngredient = (ingredient, inventoryItemsByProduct) => {
  const candidates = inventoryItemsByProduct.get(ingredient.productId) ?? [];
  const sameUnit = candidates.filter((item) => item.unit === ingredient.unit);

  if (sameUnit.length === 0 && candidates.length > 0) {
    return { status: 'unit_mismatch', availableQuantity: 0 };
  }

  const availableQuantity = sameUnit.reduce((sum, item) => sum + item.quantity, 0);
  if (availableQuantity >= ingredient.quantity) {
    return { status: 'available', availableQuantity };
  }
  if (availableQuantity > 0) {
    return { status: 'partial', availableQuantity };
  }
  return { status: 'missing', availableQuantity: 0 };
};

// ingredients: recipeRepo.listIngredients() çıktısı
// inventoryItems: inventoryItemRepo.listByHousehold() çıktısı
const matchRecipeIngredients = (ingredients, inventoryItems) => {
  const byProduct = new Map();
  for (const item of inventoryItems) {
    const list = byProduct.get(item.productId) ?? [];
    list.push(item);
    byProduct.set(item.productId, list);
  }

  return ingredients.map((ingredient) => {
    const match = matchIngredient(ingredient, byProduct);
    return { ...ingredient, matchStatus: match.status, availableQuantity: match.availableQuantity };
  });
};

// Zorunlu (is_optional=false) malzemelerden kaçı eksik/uyumsuz — suggestions
// sıralaması ve "eksikleri listeye ekle" bunu kullanır. Opsiyonel malzemeler
// eksik olsa da tarifi "eksik malzemeli" yapmaz.
const summarizeMatch = (matchedIngredients) => {
  const required = matchedIngredients.filter((i) => !i.isOptional);
  const missing = required.filter((i) => i.matchStatus === 'missing' || i.matchStatus === 'partial' || i.matchStatus === 'unit_mismatch');
  return {
    totalIngredients: required.length,
    availableIngredients: required.length - missing.length,
    missingCount: missing.length,
  };
};

export { matchIngredient, matchRecipeIngredients, summarizeMatch };
