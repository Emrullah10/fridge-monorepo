import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { requireAuth, requireHouseholdRole } from '@fridge/middlewares';

const buildRecipeRouter = ({ container }) => {
  const router = Router({ mergeParams: true });
  const { useCases, repos } = container;

  router.use(requireAuth());
  router.use(requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'viewer' }));

  router.get('/suggestions', asyncHandler(async (req, res) => {
    const suggestions = await useCases.suggestRecipes({ householdId: req.params.householdId });
    res.json({ suggestions });
  }));

  router.post('/:recipeId/cook', asyncHandler(async (req, res) => {
    const result = await useCases.cookRecipe({
      recipeId: req.params.recipeId,
      householdId: req.params.householdId,
      cookedBy: req.user.id,
    });
    res.json(result);
  }));

  return router;
};

export { buildRecipeRouter };
