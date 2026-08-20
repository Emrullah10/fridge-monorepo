import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { requireAuth, requireHouseholdRole } from '@fridge/middlewares';
import { translateDomainError } from '@fridge/errors';
import { LocationNotEmptyError } from '@fridge/core/src/domain/errors/index.js';

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
    '/:householdId/locations',
    requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'member' }),
    asyncHandler(async (req, res) => {
      const location = await useCases.createStorageLocation({
        householdId: req.params.householdId,
        name: req.body.name,
        kind: req.body.kind,
        icon: req.body.icon,
        sortOrder: req.body.sortOrder,
      });
      res.status(201).json({ location });
    }),
  );

  router.patch(
    '/:householdId/locations/:locationId',
    requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'member' }),
    asyncHandler(async (req, res) => {
      const { location, warnings } = await useCases.updateStorageLocation({
        locationId: req.params.locationId,
        householdId: req.params.householdId,
        name: req.body.name,
        kind: req.body.kind,
        icon: req.body.icon,
        sortOrder: req.body.sortOrder,
      });
      res.json({ location, warnings });
    }),
  );

  router.delete(
    '/:householdId/locations/:locationId',
    requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'admin' }),
    async (req, res, next) => {
      try {
        await useCases.deleteStorageLocation({
          locationId: req.params.locationId,
          householdId: req.params.householdId,
          strategy: req.query.strategy,
          targetLocationId: req.query.targetLocationId,
        });
        res.status(204).end();
      } catch (error) {
        if (error instanceof LocationNotEmptyError) {
          const { httpStatus, body } = translateDomainError(error);
          res.status(httpStatus).json({ ...body, itemCount: error.itemCount });
          return;
        }
        next(error);
      }
    },
  );

  // Alanın kalıcı, çok kullanımlı davet kodu — idempotent, dialog her
  // açıldığında aynı kodu döner (createInvite kendisi aktif kod arar).
  router.post(
    '/:householdId/invites',
    requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'admin' }),
    asyncHandler(async (req, res) => {
      const invite = await useCases.createInvite({
        householdId: req.params.householdId,
        invitedByUserId: req.user.id,
        invitedEmail: req.body.invitedEmail ?? null,
        expiresInDays: req.body.expiresInDays ?? null,
      });
      res.status(201).json({ invite });
    }),
  );

  // "Kodu yenile": eskisini iptal eder, bir sonraki POST /invites çağrısı
  // yenisini üretir (mobil bu ikisini art arda çağırır).
  router.post(
    '/:householdId/invites/rotate',
    requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'admin' }),
    asyncHandler(async (req, res) => {
      await useCases.revokeInvite({ householdId: req.params.householdId });
      const invite = await useCases.createInvite({
        householdId: req.params.householdId,
        invitedByUserId: req.user.id,
        expiresInDays: req.body.expiresInDays ?? null,
      });
      res.status(201).json({ invite });
    }),
  );

  router.get(
    '/:householdId/members',
    requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'viewer' }),
    asyncHandler(async (req, res) => {
      const members = await repos.householdMemberRepo.listMembers(req.params.householdId);
      res.json({ members });
    }),
  );

  // Sahip doğrudan ayrılamaz (leave-household.use-case.js OwnerCannotLeaveError
  // fırlatır) — önce sahipliği devretmeli ya da alanı silmeli.
  router.delete(
    '/:householdId/members/me',
    requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'viewer' }),
    asyncHandler(async (req, res) => {
      await useCases.leaveHousehold({ householdId: req.params.householdId, userId: req.user.id });
      res.status(204).end();
    }),
  );

  // Yalnızca sahip silebilir (kullanıcı kararı) — CASCADE ile tüm envanter/
  // fiş/üye verisini de siler, geri dönüşü yok.
  router.delete(
    '/:householdId',
    requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'owner' }),
    asyncHandler(async (req, res) => {
      await useCases.deleteHousehold({ householdId: req.params.householdId });
      res.status(204).end();
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
