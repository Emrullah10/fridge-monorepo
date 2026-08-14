import { ValidationError } from '@fridge/errors';

// Tarif + malzemeleri tek çağrıda oluşturur. ingredients boşsa suggestRecipes
// bu tarifi hiç göremez (JOIN recipe_ingredient kullanıyor) — o yüzden en
// az bir malzeme zorunlu.
const makeCreateRecipe = ({ recipeRepo }) => {
  return async ({ householdId, title, description, instructions, servings, prepMinutes, cookMinutes, sourceUrl, createdBy, ingredients }) => {
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      throw new ValidationError('En az bir malzeme gerekli');
    }

    const recipe = await recipeRepo.create({
      householdId, title, description, instructions, servings, prepMinutes, cookMinutes, sourceUrl, createdBy,
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
  };
};

export { makeCreateRecipe };
