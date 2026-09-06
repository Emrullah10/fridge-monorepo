import { Router } from 'express';
import { asyncHandler, log } from '@fridge/helper';
import { requireAuth, requireHouseholdRole, requireStructuralLimit, requireUnlockedHousehold } from '@fridge/middlewares';
import { translateDomainError } from '@fridge/errors';
import { LocationNotEmptyError } from '@fridge/core/src/domain/errors/index.js';
import { resolveLockedHouseholdIds, resolveLockedLocationIds } from '@fridge/core/src/domain/access-lock.js';

const buildHouseholdRouter = ({ container }) => {
  const router = Router();
  const { useCases, repos } = container;

  router.use(requireAuth());

  router.post(
    '/',
    // findByUserId ÜYE olunan tüm alanları döner (sahip + davetle katılan) —
    // bilinçli olarak "kaç alanla ilişkisi var" sınırlanıyor, sadece
    // "sahip olduğu" değil; aksi halde bir kullanıcı sınırsız alana davetle
    // katılıp limiti aşabilirdi.
    requireStructuralLimit('household.count', {
      getEntitlements: useCases.getEntitlements,
      countCurrent: async (req) => {
        const memberships = await repos.householdRepo.findByUserId(req.user.id);
        return memberships.length;
      },
    }),
    asyncHandler(async (req, res) => {
      const household = await useCases.createHousehold({
        name: req.body.name,
        kind: req.body.kind,
        features: req.body.features,
        ownerUserId: req.user.id,
      });
      res.status(201).json({ household });
    }),
  );

  // Kilitli alanları GİZLEMEZ, işaretler — kullanıcı verisinin kaybolduğunu
  // sanmasın, blurlu görüp "Premium ile aç" diyebilsin (bkz. plan §Faz C2).
  // entitlements hesaplaması ikincil/kozmetik bir bilgi (sadece kilit
  // işaretlemesi için) — bozulursa (bkz. bug-382) tüm alan listesini 500'e
  // düşürmemeli. Hata olursa limit=null geçilir, resolveLockedHouseholdIds
  // bunu "sınırsız" sayıp hiçbir alanı kilitlemez (fail-open).
  router.get('/', asyncHandler(async (req, res) => {
    const [households, entitlements] = await Promise.all([
      repos.householdRepo.findByUserId(req.user.id),
      useCases.getEntitlements({ userId: req.user.id, platform: req.clientPlatform }).catch((error) => {
        log.error('entitlements_fetch_failed', { userId: req.user.id, message: error.message });
        return null;
      }),
    ]);
    const memberships = await repos.householdRepo.findMembershipsWithJoinedAtByUserId(req.user.id);
    const lockedIds = resolveLockedHouseholdIds({ memberships, limit: entitlements?.householdCountLimit ?? null });
    res.json({ households: households.map((h) => ({ ...h, locked: lockedIds.has(h.id) })) });
  }));

  // household.routes.js'in KENDİ /:householdId/* alt yolları — routes/
  // index.js'teki unlockedHouseholdGate BU router'ı sarmıyor (o sadece
  // /households/:householdId/inventory vb. ayrı mount'ları sarıyor), bu
  // yüzden içerik değiştiren uçlar burada AYRICA kilitlenir (bkz. plan
  // §Faz C2 "household.routes.js'in kendi alt yolları için ikinci nokta").
  const unlockedGate = requireUnlockedHousehold({
    getEntitlements: useCases.getEntitlements,
    listMembershipsWithJoinedAt: (userId) => repos.householdRepo.findMembershipsWithJoinedAtByUserId(userId),
    resolveLockedIds: resolveLockedHouseholdIds,
  });

  router.patch(
    '/:householdId/features',
    requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'admin' }),
    unlockedGate,
    asyncHandler(async (req, res) => {
      const household = await useCases.updateHouseholdFeatures({
        householdId: req.params.householdId,
        food: req.body.food,
      });
      res.json({ household });
    }),
  );

  // Kilitli bölümleri GİZLEMEZ, işaretler — alan listesindeki aynı ilke.
  router.get(
    '/:householdId/locations',
    requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'viewer' }),
    asyncHandler(async (req, res) => {
      const [locations, entitlements] = await Promise.all([
        repos.storageLocationRepo.listByHousehold(req.params.householdId),
        useCases.getEntitlements({ userId: req.user.id, platform: req.clientPlatform }),
      ]);
      const limit = entitlements.households[req.params.householdId]?.maxLocations ?? null;
      const lockedIds = resolveLockedLocationIds({ locations, limit });
      res.json({ locations: locations.map((l) => ({ ...l, locked: lockedIds.has(l.id) })) });
    }),
  );

  router.post(
    '/:householdId/locations',
    requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'member' }),
    unlockedGate,
    requireStructuralLimit('location.perHousehold', {
      getEntitlements: useCases.getEntitlements,
      countCurrent: async (req) => {
        const locations = await repos.storageLocationRepo.listByHousehold(req.params.householdId);
        return locations.length;
      },
    }),
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
    unlockedGate,
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

  // Alan adı + serbest simge (features.icon) güncellemesi. Tür (household.kind)
  // arayüzden kalktığı için burada değiştirilmez.
  router.patch(
    '/:householdId',
    requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'admin' }),
    asyncHandler(async (req, res) => {
      const household = await useCases.updateHouseholdProfile({
        householdId: req.params.householdId,
        name: req.body.name,
        icon: req.body.icon,
      });
      res.json({ household });
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
