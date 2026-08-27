import { NotFoundError, ForbiddenError } from '@fridge/errors';

const makeDeleteRecipe = ({ recipeRepo }) => {
  return async ({ recipeId, householdId }) => {
    const existing = await recipeRepo.findById(recipeId);
    if (!existing) throw new NotFoundError('Recipe not found');
    if (existing.householdId !== householdId) throw new ForbiddenError('Bu tarif silinemez');

    await recipeRepo.delete(recipeId);
  };
};

export { makeDeleteRecipe };
