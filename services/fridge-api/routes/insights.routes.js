import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { requireAuth, requireHouseholdRole } from '@fridge/middlewares';
import { resolveInsightsWindow } from '@fridge/core/src/domain/access-lock.js';

const buildInsightsRouter = ({ container }) => {
  const router = Router({ mergeParams: true });
  const { useCases, repos } = container;

  router.use(requireAuth());
  router.use(requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'viewer' }));

  // GET /households/:householdId/insights?from=ISO&to=ISO
  // from/to verilmezse içinde bulunulan takvim ayı. Pencere ALAN SAHİBİNİN
  // planından gelir (entitlements.households[householdId].insightsWindowDays
  // — entitlements.js resolveHouseholdLimits), kullanıcının kendi planından
  // değil; getHouseholdInsights'ın imzası userId almadığı için kırpma
  // ROUTE seviyesinde yapılır, use-case'e hiç dokunulmaz (bkz. plan §Faz B).
  router.get('/', asyncHandler(async (req, res) => {
    const entitlements = await useCases.getEntitlements({ userId: req.user.id, platform: req.clientPlatform });
    const windowDays = entitlements.households[req.params.householdId]?.insightsWindowDays ?? null;
    const { from, truncated } = resolveInsightsWindow({ windowDays, requestedFrom: req.query.from });

    const data = await useCases.getHouseholdInsights({
      householdId: req.params.householdId,
      from,
      to: req.query.to,
    });
    res.json({ ...data, windowDays, truncated });
  }));

  return router;
};

export { buildInsightsRouter };
