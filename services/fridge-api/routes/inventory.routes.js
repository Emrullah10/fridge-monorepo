import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { requireAuth, requireHouseholdRole } from '@fridge/middlewares';

const buildInventoryRouter = ({ container }) => {
  const router = Router({ mergeParams: true });
  const { useCases, repos } = container;

  router.use(requireAuth());
  router.use(requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'viewer' }));

  router.get('/', asyncHandler(async (req, res) => {
    const items = await useCases.listInventoryItems({
      householdId: req.params.householdId,
      storageLocationId: req.query.storageLocationId,
    });
    res.json({ items });
  }));

  router.get('/expiring', asyncHandler(async (req, res) => {
    const items = await useCases.listExpiringItems({
      householdId: req.params.householdId,
      withinDays: req.query.withinDays ? Number(req.query.withinDays) : undefined,
    });
    res.json({ items });
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const item = await useCases.addInventoryItem({
      householdId: req.params.householdId,
      storageLocationId: req.body.storageLocationId,
      productId: req.body.productId,
      unit: req.body.unit,
      quantity: req.body.quantity,
      expiresAt: req.body.expiresAt ?? null,
      unitPrice: req.body.unitPrice,
      actorUserId: req.user.id,
    });
    res.status(201).json({ item });
  }));

  // reason: 'consumed' (kullanıldı, para tasarrufu sayılır) | 'expired' |
  // 'discarded' (bozuldu/atıldı, israf sayılır). Geçersiz/eksik → 'consumed'.
  const CONSUME_REASONS = new Set(['consumed', 'expired', 'discarded']);

  router.post('/:itemId/consume', asyncHandler(async (req, res) => {
    const reason = CONSUME_REASONS.has(req.body.reason) ? req.body.reason : 'consumed';
    const item = await useCases.consumeInventoryItem({
      inventoryItemId: req.params.itemId,
      householdId: req.params.householdId,
      quantity: req.body.quantity,
      reason,
      actorUserId: req.user.id,
    });
    res.json({ item });
  }));

  router.patch('/:itemId', asyncHandler(async (req, res) => {
    const item = await useCases.updateInventoryItem({
      inventoryItemId: req.params.itemId,
      householdId: req.params.householdId,
      quantity: req.body.quantity,
      expiresAt: req.body.expiresAt,
      openedAt: req.body.openedAt,
      note: req.body.note,
      unitPrice: req.body.unitPrice,
      actorUserId: req.user.id,
    });
    res.json({ item });
  }));

  // ?reason=discarded|expired — kalem tamamen siliniyor; israf ayrımı için.
  const DELETE_REASONS = new Set(['discarded', 'expired', 'consumed']);

  router.delete('/:itemId', asyncHandler(async (req, res) => {
    const reason = DELETE_REASONS.has(req.query.reason) ? req.query.reason : 'discarded';
    await useCases.deleteInventoryItem({
      inventoryItemId: req.params.itemId,
      householdId: req.params.householdId,
      reason,
      actorUserId: req.user.id,
    });
    res.status(204).end();
  }));

  return router;
};

export { buildInventoryRouter };
