// Tarif besin değeri hesabı — saf fonksiyon, ingredient-match.js deseni.
// SAKLANMAZ, okuma anında hesaplanır (suggestedStorageKind kararının aynısı,
// cerebrum 2026-08-17): malzeme düzeltilince değer otomatik güncel olur.
//
// product.nutrition 100g VEYA 100ml başına: {kcal, protein, carb, fat, basis}.
// Bir malzemenin miktarı gram/ml cinsine çevrilemiyorsa (piece/package) O
// malzeme atlanır ve "incomplete" işaretlenir — TAHMİN UYDURULMAZ.

const GRAM_UNITS = { gram: 1, kilogram: 1000 };
const ML_UNITS = { milliliter: 1, liter: 1000 };

// ingredient.unit -> nutrition.basis ile uyumlu baz miktarı (gram veya ml).
// Uyumsuzsa null döner.
const toBaseAmount = (quantity, unit, basis) => {
  if (basis === '100g' || basis === '100ml' || basis === undefined || basis === null) {
    if (GRAM_UNITS[unit] !== undefined) return quantity * GRAM_UNITS[unit];
    if (ML_UNITS[unit] !== undefined) return quantity * ML_UNITS[unit];
    return null; // piece/package -> gram/ml'ye deterministik çeviri yok
  }
  return null;
};

// ingredients: [{ productId, quantity, unit, isOptional, nutrition? }]
//   nutrition: ürünün 100g/100ml başına değeri, çağıran taraf JOIN'le getirir.
// servings: tarif kaç kişilik (bölmek için); null/0 ise bölünmez.
const computeRecipeNutrition = (ingredients, servings) => {
  let kcal = 0;
  let protein = 0;
  let carb = 0;
  let fat = 0;
  let counted = 0;
  let skipped = 0;

  for (const ing of ingredients) {
    const n = ing.nutrition;
    if (!n || n.kcal === undefined || n.kcal === null) {
      skipped++;
      continue;
    }
    const base = toBaseAmount(ing.quantity, ing.unit, n.basis);
    if (base === null) {
      skipped++;
      continue;
    }
    const factor = base / 100; // nutrition 100 birim başına
    kcal += (n.kcal ?? 0) * factor;
    protein += (n.protein ?? 0) * factor;
    carb += (n.carb ?? 0) * factor;
    fat += (n.fat ?? 0) * factor;
    counted++;
  }

  const divisor = servings && servings > 0 ? servings : 1;
  const round1 = (v) => Math.round((v / divisor) * 10) / 10;

  return {
    perServing: {
      kcal: Math.round(kcal / divisor),
      protein: round1(protein),
      carb: round1(carb),
      fat: round1(fat),
    },
    // counted malzeme değere katıldı, skipped katılamadı (besin verisi yok
    // veya birim çevrilemedi). skipped > 0 ise UI "yaklaşık" göstermeli.
    countedIngredients: counted,
    skippedIngredients: skipped,
    complete: skipped === 0 && counted > 0,
  };
};

// Hane üyelerinin diyet profillerinden birleşik alerjen/diyet kısıtı çıkarır —
// tarif önerisi/AI Chef prompt'una girdi olur, çakışan tarifler elenir.
// profiles: [{ allergens?: string[], diet?: string }]
const mergeDietConstraints = (profiles) => {
  const allergens = new Set();
  const diets = new Set();
  for (const p of profiles) {
    if (!p) continue;
    for (const a of p.allergens ?? []) {
      if (typeof a === 'string' && a.trim()) allergens.add(a.trim().toLocaleLowerCase('tr'));
    }
    if (p.diet && p.diet !== 'none') diets.add(p.diet);
  }
  return { allergens: [...allergens], diets: [...diets] };
};

export { toBaseAmount, computeRecipeNutrition, mergeDietConstraints };
