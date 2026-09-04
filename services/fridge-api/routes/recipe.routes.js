import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { requireAuth, requireHouseholdRole, requireHouseholdFeature, requireCapability, rateLimiter } from '@fridge/middlewares';
import { ValidationError } from '@fridge/errors';
import { resolveFeatures } from '@fridge/core/src/domain/household-profile.js';
import { canUseAiFeature } from '@fridge/core/src/domain/entitlements.js';

const buildRecipeRouter = ({ container }) => {
  const router = Router({ mergeParams: true });
  const { useCases, repos } = container;

  router.use(requireAuth());
  router.use(requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'viewer' }));
  // Yemek özelliği kapalı alanlarda (ör. atölye/dükkan) tarifler anlamsız —
  // mobil navbar zaten gizliyor, ama doğrudan istek atılabildiği için
  // sunucu da uygulamalı.
  router.use(requireHouseholdFeature('food', { householdRepo: repos.householdRepo, resolveFeatures }));

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

  // Plan/kota kontrolü + rezervasyon (misafir burada SIGNUP_REQUIRED alır —
  // demo mod mobil tarafta, bkz. plan §Faz 2). requireHouseholdFeature'dan
  // SONRA, rateLimiter'dan ÖNCE (402, 429'dan önce dönmeli).
  router.post(
    '/generate',
    requireCapability('recipe', {
      getEntitlements: useCases.getEntitlements,
      reserveAiUsage: useCases.reserveAiUsage,
      canUseAiFeature,
    }),
    rateLimiter({ windowMs: 60_000, maxRequests: 3, keyFn: (req) => req.user.id, limitName: 'recipe-generate' }),
    asyncHandler(async (req, res) => {
    if (!useCases.generateAiRecipes) {
      await useCases.releaseAiUsage({ refId: req.aiUsageRefId });
      return res.status(503).json({ error: { code: 'AI_DISABLED', message: 'Tarif üretimi şu anda kapalı' } });
    }
    try {
      const result = await useCases.generateAiRecipes({
        householdId: req.params.householdId,
        createdBy: req.user.id,
        preferences: req.body?.preferences ?? {},
        isGuest: req.user.isGuest ?? false,
      });
      res.status(201).json(result);
    } catch (error) {
      // AiQuotaError/AiBusyError/AiTimeoutError dahil her hata kotayı iade
      // eder — kullanıcı bir değer almadıysa ödemez (plan §Faz 3).
      await useCases.releaseAiUsage({ refId: req.aiUsageRefId });
      throw error;
    }
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
