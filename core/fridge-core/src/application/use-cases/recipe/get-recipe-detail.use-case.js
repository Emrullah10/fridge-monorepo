import { NotFoundError } from '@fridge/errors';
import { matchRecipeIngredients } from '../../../domain/ingredient-match.js';
import { computeRecipeNutrition } from '../../../domain/nutrition.js';

const makeGetRecipeDetail = ({ recipeRepo, inventoryItemRepo }) => {
  return async ({ recipeId, householdId }) => {
    const recipe = await recipeRepo.findById(recipeId);
    // Global tarif (householdId null) veya bu evin kendi tarifi olabilir;
    // başka bir evin özel tarifi görülemez.
    if (!recipe || (recipe.householdId !== null && recipe.householdId !== householdId)) {
      throw new NotFoundError('Recipe not found');
    }

    const ingredients = await recipeRepo.listIngredients(recipeId);
    const inventoryItems = await inventoryItemRepo.listByHousehold(householdId);
    const matchedIngredients = matchRecipeIngredients(ingredients, inventoryItems);

    // Besin değeri okuma anında hesaplanır (SAKLANMAZ) — malzeme/porsiyon
    // düzeltilince otomatik güncel olur. Verisi olmayan malzemeler atlanır,
    // skippedIngredients > 0 ise UI "yaklaşık" göstermeli.
    const nutrition = computeRecipeNutrition(ingredients, recipe.servings);

    return { ...recipe, ingredients: matchedIngredients, nutrition };
  };
};

export { makeGetRecipeDetail };
