import { ValidationError } from '@fridge/errors';
import { classifyForRecipe } from '../../../domain/recipe-eligibility.js';
import { isUncertainProductName } from '../../../domain/name-confidence.js';
import { mergeDietConstraints } from '../../../domain/nutrition.js';
import { findBrandInText } from '../../../infrastructure/parser/turkish-brands.js';

// Prompt kural 3 markayı girdi tarafında görmesine izin veriyor (ürünün ne
// olduğunu anlaması için) ama çıktıda ("ingredients[].name") marka
// istenmiyor. Model yine de sızdırırsa (ör. "Sütaş Süt") productRepo.search
// bunu farklı bir ürün sanıp gereksiz yeni bir ai_generated ürün yaratır —
// eşleştirmeden önce isimden markayı sıyırıyoruz.
const stripBrandFromName = (name) => {
  const brand = findBrandInText(name);
  if (!brand) return name;
  const stripped = name.replace(new RegExp(`^${brand}\\s+`, 'i'), '').trim();
  return stripped || name;
};

// Envanteri Gemini'ye gönderir, malzeme adlarını product tablosuna eşler
// (product.repository.js:search() fuzzy/substring eşleştirme yapıyor), sonra
// tarif + malzemeleri household'a özel (householdId dolu) olarak kaydeder.
//
// KASITLI OLARAK YENİ PRODUCT YARATMIYOR. Önceden eşleşmeyen malzeme için
// productRepo.create(source:'ai_generated') çağrılıyordu — bu bir kirlenme
// döngüsüne yol açtı: fiş bozuk bir isim üretiyor ("Kızılay Mangoana"),
// tarif AI'ı bu ismi görüp daha da bozuk bir malzeme adı yazıyor ("Kızılay
// Mango Kiz Tilay"), burası bunu bulamayınca YENİ bir kategorisiz ürün
// yaratıyordu — her tarif üretimi kataloğu biraz daha bozuyordu. Artık
// eşleşmeyen malzeme customName ile serbest metin olarak kaydediliyor
// (bkz. 13-recipe-ingredient-custom-name.sql, shopping_list_item deseni).
// Katalog sadece fiş/kullanıcı tarafından büyür.
const makeGenerateAiRecipes = ({
  datasource,
  inventoryItemRepo,
  householdMemberRepo,
  makeProductRepo,
  makeRecipeRepo,
  recipeGeneratorPort,
}) => {
  return async ({ householdId, createdBy, preferences = {} }) => {
    const inventoryItems = await inventoryItemRepo.listByHousehold(householdId);
    if (inventoryItems.length === 0) {
      throw new ValidationError('Tarif üretmek için dolabında en az bir ürün olmalı');
    }

    // Hane üyelerinin diyet/alerjen kısıtları — prompt'a girer, model çakışan
    // tarifleri elemek zorunda. householdMemberRepo opsiyonel (geriye dönük).
    if (householdMemberRepo?.listDietProfiles) {
      const { allergens, diets } = mergeDietConstraints(await householdMemberRepo.listDietProfiles(householdId));
      if (allergens.length > 0 && !preferences.allergens) preferences = { ...preferences, allergens };
      if (diets.length > 0 && !preferences.diets) preferences = { ...preferences, diets };
    }

    const enriched = inventoryItems.map((item) => ({
      productId: item.productId,
      name: item.productName,
      brand: item.productBrand ?? null,
      categoryId: item.categoryId ?? null,
      quantity: item.quantity,
      unit: item.unit,
      expiresAt: item.expiresAt,
      isUncertain: isUncertainProductName(item.productName, { productSource: item.productSource, brand: item.productBrand }),
    })).filter((item) => classifyForRecipe(item) !== 'excluded');

    const ingredients = enriched.filter((item) => classifyForRecipe(item) === 'ingredient');
    const beverages = enriched.filter((item) => classifyForRecipe(item) === 'beverage');

    if (ingredients.length === 0 && beverages.length === 0) {
      throw new ValidationError('Dolabındaki ürünler yemek malzemesi olarak tanınmadı');
    }

    const { recipes } = await recipeGeneratorPort.generate({ ingredients, beverages, preferences });

    return datasource.withTransaction(async ({ query }) => {
      const productRepo = makeProductRepo({ rawQuery: query });
      const recipeRepo = makeRecipeRepo({ rawQuery: query });
      const created = [];

      for (const generated of recipes) {
        const resolvedIngredients = [];
        for (const ingredient of generated.ingredients) {
          const cleanName = stripBrandFromName(ingredient.name);
          const matches = await productRepo.search({ householdId, query: cleanName, limit: 1 });
          const product = matches[0];
          resolvedIngredients.push({
            productId: product?.id ?? null,
            customName: product ? null : cleanName,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            isOptional: ingredient.isOptional ?? false,
          });
        }

        const recipe = await recipeRepo.create({
          householdId,
          title: generated.title,
          description: generated.description,
          instructions: generated.steps.map((s) => `${s.order}. ${s.text}`).join('\n'),
          steps: generated.steps,
          servings: generated.servings,
          prepMinutes: generated.prepMinutes,
          cookMinutes: generated.cookMinutes,
          createdBy,
          generatedBy: 'ai',
        });

        for (const ingredient of resolvedIngredients) {
          await recipeRepo.addIngredient({ recipeId: recipe.id, ...ingredient });
        }

        created.push({ ...recipe, ingredients: resolvedIngredients, missingIngredients: generated.missingIngredients, tags: generated.tags });
      }

      return { recipes: created };
    });
  };
};

export { makeGenerateAiRecipes };
