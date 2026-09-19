import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { requireAuth, requireCapability, rateLimiter } from '@fridge/middlewares';
import { canUseAiFeature } from '@fridge/core/src/domain/entitlements.js';
import { ValidationError } from '@fridge/errors';
import { makeLoadConversation } from './helpers/load-conversation.js';

// KÖK SEVİYEDE mount edilir (household ağacından ÇIKAR, bkz. plan §C2) —
// alansız sohbette :householdId path parametresi yok, requireHouseholdRole
// path'ten çalışamaz. Sahiplik path'ten DEĞİL kayıttan (conversation) gelir.
const buildAssistantRouter = ({ container }) => {
  const router = Router();
  const { useCases, repos } = container;

  router.use(requireAuth());

  const loadConversation = makeLoadConversation({ container });

  router.get('/conversations', asyncHandler(async (req, res) => {
    const conversations = await repos.assistantConversationRepo.listByUser(req.user.id);
    res.json({ conversations });
  }));

  router.post('/conversations', asyncHandler(async (req, res) => {
    if (!useCases.createConversation) {
      return res.status(503).json({ error: { code: 'AI_DISABLED', message: 'AI Asistan şu anda kapalı' } });
    }
    const conversation = await useCases.createConversation({
      userId: req.user.id,
      householdId: req.body?.householdId ?? null,
      mode: req.body?.mode ?? 'general',
      platform: req.clientPlatform,
    });
    res.status(201).json({ conversation });
  }));

  router.patch('/conversations/:id', loadConversation, asyncHandler(async (req, res) => {
    const { title, householdId, mode } = req.body ?? {};
    const conversation = await repos.assistantConversationRepo.update(req.conversation.id, { title, householdId, mode });
    res.json({ conversation });
  }));

  router.delete('/conversations/:id', loadConversation, asyncHandler(async (req, res) => {
    await repos.assistantConversationRepo.delete(req.conversation.id);
    res.status(204).end();
  }));

  router.get('/conversations/:id/messages', loadConversation, asyncHandler(async (req, res) => {
    const messages = await repos.assistantConversationRepo.listAllMessages(req.conversation.id);
    res.json({ messages });
  }));

  // Plan/kota kontrolü + rezervasyon — requireCapability rateLimiter'dan
  // ÖNCE (402, 429'dan önce dönmeli, chef.routes.js:25-35 deseni birebir
  // korunur, bkz. plan §C4).
  router.post(
    '/conversations/:id/messages',
    loadConversation,
    requireCapability('chef', {
      getEntitlements: useCases.getEntitlements,
      reserveAiUsage: useCases.reserveAiUsage,
      canUseAiFeature,
    }),
    rateLimiter({ windowMs: 60_000, maxRequests: 10, keyFn: (req) => req.user.id, limitName: 'assistant-messages' }),
    asyncHandler(async (req, res) => {
      if (!useCases.sendAssistantMessage) {
        await useCases.releaseAiUsage({ refId: req.aiUsageRefId });
        return res.status(503).json({ error: { code: 'AI_DISABLED', message: 'AI Asistan şu anda kapalı' } });
      }
      try {
        const result = await useCases.sendAssistantMessage({
          conversation: req.conversation,
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

  // AI çağırmaz -> requireCapability gerekmez (§C4).
  router.post('/messages/:messageId/save-guide', asyncHandler(async (req, res) => {
    if (!useCases.saveGuideAsRecipe) {
      return res.status(503).json({ error: { code: 'AI_DISABLED', message: 'AI Asistan şu anda kapalı' } });
    }
    const recipe = await useCases.saveGuideAsRecipe({
      messageId: req.params.messageId,
      userId: req.user.id,
      householdId: req.body?.householdId ?? null,
    });
    res.status(201).json({ recipe });
  }));

  return router;
};

export { buildAssistantRouter };
