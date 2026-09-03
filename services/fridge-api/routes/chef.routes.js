import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { requireAuth, requireHouseholdRole, requireHouseholdFeature, requireCapability, rateLimiter } from '@fridge/middlewares';
import { resolveFeatures } from '@fridge/core/src/domain/household-profile.js';
import { canUseAiFeature } from '@fridge/core/src/domain/entitlements.js';

const buildChefRouter = ({ container }) => {
  const router = Router({ mergeParams: true });
  const { useCases, repos } = container;

  router.use(requireAuth());
  router.use(requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'viewer' }));
  // Yemek özelliği kapalı alanlarda AI Chef anlamsız — bkz. recipe.routes.js.
  router.use(requireHouseholdFeature('food', { householdRepo: repos.householdRepo, resolveFeatures }));

  // Sohbet geçmişi (kronolojik).
  router.get('/messages', asyncHandler(async (req, res) => {
    const messages = await repos.chefChatRepo.listRecent({
      householdId: req.params.householdId,
      limit: req.query.limit ? Number(req.query.limit) : 30,
    });
    res.json({ messages });
  }));

  // Plan/kota kontrolü + rezervasyon — misafir burada SIGNUP_REQUIRED alır
  // (demo mod mobil tarafta, bkz. plan §Faz 2). requireHouseholdFeature'dan
  // SONRA, rateLimiter'dan ÖNCE (402, 429'dan önce dönmeli).
  router.post(
    '/messages',
    requireCapability('chef', {
      getEntitlements: useCases.getEntitlements,
      reserveAiUsage: useCases.reserveAiUsage,
      canUseAiFeature,
    }),
    rateLimiter({ windowMs: 60_000, maxRequests: 10, keyFn: (req) => req.user.id, limitName: 'chef-messages' }),
    asyncHandler(async (req, res) => {
      if (!useCases.sendChefMessage) {
        await useCases.releaseAiUsage({ refId: req.aiUsageRefId });
        return res.status(503).json({ error: { code: 'AI_DISABLED', message: 'AI Chef şu anda kapalı' } });
      }
      try {
        const result = await useCases.sendChefMessage({
          householdId: req.params.householdId,
          userId: req.user.id,
          message: req.body?.message,
          isGuest: req.user.isGuest ?? false,
        });
        res.status(201).json(result);
      } catch (error) {
        await useCases.releaseAiUsage({ refId: req.aiUsageRefId });
        throw error;
      }
    }),
  );

  router.delete('/messages', asyncHandler(async (req, res) => {
    await repos.chefChatRepo.clear(req.params.householdId);
    res.status(204).end();
  }));

  return router;
};

export { buildChefRouter };
