import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { requireAuth, requireHouseholdRole } from '@fridge/middlewares';

const buildHouseholdRouter = ({ container }) => {
  const router = Router();
  const { useCases, repos } = container;

  router.use(requireAuth());

  router.post('/', asyncHandler(async (req, res) => {
    const household = await useCases.createHousehold({
      name: req.body.name,
      kind: req.body.kind,
      ownerUserId: req.user.id,
    });
    res.status(201).json({ household });
  }));

  router.get('/', asyncHandler(async (req, res) => {
    const households = await repos.householdRepo.findByUserId(req.user.id);
    res.json({ households });
  }));

  router.get(
    '/:householdId/locations',
    requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'viewer' }),
    asyncHandler(async (req, res) => {
      const locations = await repos.storageLocationRepo.listByHousehold(req.params.householdId);
      res.json({ locations });
    }),
  );

  router.post(
    '/:householdId/invites',
    requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'admin' }),
    asyncHandler(async (req, res) => {
      const invite = await useCases.createInvite({
        householdId: req.params.householdId,
        invitedByUserId: req.user.id,
        invitedEmail: req.body.invitedEmail ?? null,
      });
      res.status(201).json({ invite });
    }),
  );

  router.patch(
    '/:householdId/settings',
    requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'admin' }),
    asyncHandler(async (req, res) => {
      const household = await useCases.updateHouseholdSettings({
        householdId: req.params.householdId,
        receiptImageRetentionDays: req.body.receiptImageRetentionDays,
      });
      res.json({ household });
    }),
  );

  return router;
};

export { buildHouseholdRouter };
