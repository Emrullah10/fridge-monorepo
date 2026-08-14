import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { requireAuth, requireHouseholdRole } from '@fridge/middlewares';
import { ValidationError } from '@fridge/errors';

const buildRecipeRouter = ({ container }) => {
  const router = Router({ mergeParams: true });
  const { useCases, repos } = container;

  router.use(requireAuth());
  router.use(requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'viewer' }));

  router.get('/', asyncHandler(async (req, res) => {
    const recipes = await repos.recipeRepo.listByHousehold(req.params.householdId);
    res.json({ recipes });
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const { title, description, instructions, servings, prepMinutes, cookMinutes, sourceUrl, ingredients } = req.body ?? {};
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new ValidationError('Tarif başlığı gerekli');
    }
    if (typeof instructions !== 'string' || instructions.trim().length === 0) {
      throw new ValidationError('Tarif talimatları gerekli');
    }

    const recipe = await useCases.createRecipe({
      householdId: req.params.householdId,
      title,
      description: description ?? null,
      instructions,
      servings: servings ?? null,
      prepMinutes: prepMinutes ?? null,
      cookMinutes: cookMinutes ?? null,
      sourceUrl: sourceUrl ?? null,
      createdBy: req.user.id,
      ingredients,
    });
    res.status(201).json({ recipe });
  }));

  router.get('/suggestions', asyncHandler(async (req, res) => {
    const suggestions = await useCases.suggestRecipes({ householdId: req.params.householdId });
    res.json({ suggestions });
  }));

  router.get('/:recipeId', asyncHandler(async (req, res) => {
    const recipe = await useCases.getRecipeDetail({
      recipeId: req.params.recipeId,
      householdId: req.params.householdId,
    });
    res.json({ recipe });
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
