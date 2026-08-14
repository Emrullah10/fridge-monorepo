import { NotFoundError } from '@fridge/errors';

const makeGetRecipeDetail = ({ recipeRepo }) => {
  return async ({ recipeId, householdId }) => {
    const recipe = await recipeRepo.findById(recipeId);
    // Global tarif (householdId null) veya bu evin kendi tarifi olabilir;
    // başka bir evin özel tarifi görülemez.
    if (!recipe || (recipe.householdId !== null && recipe.householdId !== householdId)) {
      throw new NotFoundError('Recipe not found');
    }

    const ingredients = await recipeRepo.listIngredients(recipeId);
    return { ...recipe, ingredients };
  };
};

export { makeGetRecipeDetail };
