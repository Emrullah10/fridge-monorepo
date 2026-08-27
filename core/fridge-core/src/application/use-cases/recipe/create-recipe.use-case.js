import { ValidationError } from '@fridge/errors';

// Tarif + malzemeleri tek çağrıda oluşturur. ingredients boşsa suggestRecipes
// bu tarifi hiç göremez (JOIN recipe_ingredient kullanıyor) — o yüzden en
// az bir malzeme zorunlu. datasource.withTransaction'a sarılı: malzeme
// döngüsünün ortasında hata olursa yarım tarif kalmasın diye.
const makeCreateRecipe = ({ datasource, makeRecipeRepo }) => {
  return async ({ householdId, title, description, instructions, steps, servings, prepMinutes, cookMinutes, sourceUrl, createdBy, ingredients, generatedBy = 'user' }) => {
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      throw new ValidationError('En az bir malzeme gerekli');
    }

    return datasource.withTransaction(async ({ query }) => {
      const recipeRepo = makeRecipeRepo({ rawQuery: query });

      const recipe = await recipeRepo.create({
        householdId, title, description, instructions, steps, servings, prepMinutes, cookMinutes, sourceUrl, createdBy, generatedBy,
      });

      for (const ingredient of ingredients) {
        await recipeRepo.addIngredient({
          recipeId: recipe.id,
          productId: ingredient.productId,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          isOptional: ingredient.isOptional ?? false,
        });
      }

      return recipe;
    });
  };
};

export { makeCreateRecipe };
