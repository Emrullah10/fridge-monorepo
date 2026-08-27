import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { requireAuth, requireHouseholdRole, rateLimiter } from '@fridge/middlewares';

const buildChefRouter = ({ container }) => {
  const router = Router({ mergeParams: true });
  const { useCases, repos } = container;

  router.use(requireAuth());
  router.use(requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'viewer' }));

  // Sohbet geçmişi (kronolojik).
  router.get('/messages', asyncHandler(async (req, res) => {
    const messages = await repos.chefChatRepo.listRecent({
      householdId: req.params.householdId,
      limit: req.query.limit ? Number(req.query.limit) : 30,
    });
    res.json({ messages });
  }));

  // Her mesaj Gemini'ye para harcıyor — dakikada 10 istekle sınırla.
  router.post(
    '/messages',
    rateLimiter({ windowMs: 60_000, maxRequests: 10, keyFn: (req) => req.user.id }),
    asyncHandler(async (req, res) => {
      if (!useCases.sendChefMessage) {
        return res.status(503).json({ error: { code: 'AI_DISABLED', message: 'AI Chef şu anda kapalı' } });
      }
      const result = await useCases.sendChefMessage({
        householdId: req.params.householdId,
        userId: req.user.id,
        message: req.body?.message,
      });
      res.status(201).json(result);
    }),
  );

  router.delete('/messages', asyncHandler(async (req, res) => {
    await repos.chefChatRepo.clear(req.params.householdId);
    res.status(204).end();
  }));

  return router;
};

export { buildChefRouter };
