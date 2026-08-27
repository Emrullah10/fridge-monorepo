// generate({ ingredients, beverages, preferences }) -> { recipes: [...] }
// ingredients: [{ productId, name, brand, categoryId, quantity, unit, expiresAt, isUncertain }]
// beverages: aynı şekil, 'beverages' kategorisindeki kalemler (yalnızca
//   sıvı/kabartıcı rolde kullanılabilir, ana malzeme değil)
// preferences: { mealType?, maxMinutes?, dietary? } (opsiyonel, hepsi olabilir null)
// Dönüş: her recipe -> { title, description, servings, prepMinutes, cookMinutes,
//   difficulty, steps: [{order, text, minutes}], ingredients: [{name, quantity, unit, isOptional}],
//   missingIngredients: [string], tags: [string] }
export {};
