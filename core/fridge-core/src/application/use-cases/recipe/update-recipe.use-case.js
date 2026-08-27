import { NotFoundError, ForbiddenError } from '@fridge/errors';

// Global tarifler (householdId null) düzenlenemez — sadece kendi evinin
// tarifi (AI üretimi dahil) düzenlenebilir.
const makeUpdateRecipe = ({ recipeRepo }) => {
  return async ({ recipeId, householdId, ...changes }) => {
    const existing = await recipeRepo.findById(recipeId);
    if (!existing) throw new NotFoundError('Recipe not found');
    if (existing.householdId !== householdId) throw new ForbiddenError('Bu tarif düzenlenemez');

    return recipeRepo.update(recipeId, changes);
  };
};

export { makeUpdateRecipe };
