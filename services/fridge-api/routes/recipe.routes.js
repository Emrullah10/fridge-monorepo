import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { requireAuth, requireHouseholdRole, rateLimiter } from '@fridge/middlewares';
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

  router.get('/cook-log', asyncHandler(async (req, res) => {
    const entries = await repos.recipeCookLogRepo.listByHousehold(req.params.householdId);
    res.json({ entries });
  }));

  router.get('/favorites', asyncHandler(async (req, res) => {
    const recipeIds = await repos.recipeFavoriteRepo.listRecipeIdsForUser({
      householdId: req.params.householdId,
      userId: req.user.id,
    });
    res.json({ recipeIds });
  }));

  // Her istek Gemini'ye para harcıyor — dakikada 3 istekle sınırla.
  router.post('/generate', rateLimiter({ windowMs: 60_000, maxRequests: 3, keyFn: (req) => req.user.id }), asyncHandler(async (req, res) => {
    if (!useCases.generateAiRecipes) {
      return res.status(503).json({ error: { code: 'AI_DISABLED', message: 'Tarif üretimi şu anda kapalı' } });
    }
    const result = await useCases.generateAiRecipes({
      householdId: req.params.householdId,
      createdBy: req.user.id,
      preferences: req.body?.preferences ?? {},
    });
    res.status(201).json(result);
  }));

  router.get('/:recipeId', asyncHandler(async (req, res) => {
    const recipe = await useCases.getRecipeDetail({
      recipeId: req.params.recipeId,
      householdId: req.params.householdId,
    });
    res.json({ recipe });
  }));

  router.patch('/:recipeId', asyncHandler(async (req, res) => {
    const recipe = await useCases.updateRecipe({
      recipeId: req.params.recipeId,
      householdId: req.params.householdId,
      title: req.body.title,
      description: req.body.description,
      instructions: req.body.instructions,
      steps: req.body.steps,
      servings: req.body.servings,
      prepMinutes: req.body.prepMinutes,
      cookMinutes: req.body.cookMinutes,
      sourceUrl: req.body.sourceUrl,
    });
    res.json({ recipe });
  }));

  router.delete('/:recipeId', asyncHandler(async (req, res) => {
    await useCases.deleteRecipe({ recipeId: req.params.recipeId, householdId: req.params.householdId });
    res.status(204).end();
  }));

  router.post('/:recipeId/cook', asyncHandler(async (req, res) => {
    const result = await useCases.cookRecipe({
      recipeId: req.params.recipeId,
      householdId: req.params.householdId,
      cookedBy: req.user.id,
    });
    res.json(result);
  }));

  router.post('/:recipeId/favorite', asyncHandler(async (req, res) => {
    await repos.recipeFavoriteRepo.add({
      householdId: req.params.householdId,
      recipeId: req.params.recipeId,
      userId: req.user.id,
    });
    res.status(204).end();
  }));

  router.delete('/:recipeId/favorite', asyncHandler(async (req, res) => {
    await repos.recipeFavoriteRepo.remove({ recipeId: req.params.recipeId, userId: req.user.id });
    res.status(204).end();
  }));

  return router;
};

export { buildRecipeRouter };
