import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { requireAuth, requireHouseholdRole } from '@fridge/middlewares';

const buildInsightsRouter = ({ container }) => {
  const router = Router({ mergeParams: true });
  const { useCases, repos } = container;

  router.use(requireAuth());
  router.use(requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'viewer' }));

  // GET /households/:householdId/insights?from=ISO&to=ISO
  // from/to verilmezse içinde bulunulan takvim ayı.
  router.get('/', asyncHandler(async (req, res) => {
    const data = await useCases.getHouseholdInsights({
      householdId: req.params.householdId,
      from: req.query.from,
      to: req.query.to,
    });
    res.json(data);
  }));

  return router;
};

export { buildInsightsRouter };
