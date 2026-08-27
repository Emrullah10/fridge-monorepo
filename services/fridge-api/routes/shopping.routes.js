import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { requireAuth, requireHouseholdRole, rateLimiter } from '@fridge/middlewares';
import { ValidationError } from '@fridge/errors';

const buildShoppingRouter = ({ container }) => {
  const router = Router({ mergeParams: true });
  const { useCases, repos } = container;

  router.use(requireAuth());
  router.use(requireHouseholdRole({ householdMemberRepo: repos.householdMemberRepo, minRole: 'viewer' }));

  router.get('/', asyncHandler(async (req, res) => {
    const { list, items } = await useCases.getShoppingList({
      householdId: req.params.householdId,
      userId: req.user.id,
    });
    res.json({ list, items });
  }));

  router.get('/suggestions', asyncHandler(async (req, res) => {
    const suggestions = await useCases.suggestShoppingItems({
      householdId: req.params.householdId,
      userId: req.user.id,
    });
    res.json({ suggestions });
  }));

  // Açık kullanıcı jesti — otomatik çağrılmaz, her istek Gemini'ye para
  // harcıyor. Mevcut GET /suggestions (ücretsiz, otomatik yüklenen) aynen
  // kalır, bu AI yolu ayrı ve isteğe bağlı.
  router.post('/suggestions/ai', rateLimiter({ windowMs: 60_000, maxRequests: 3, keyFn: (req) => req.user.id }), asyncHandler(async (req, res) => {
    if (!useCases.suggestAiShoppingItems) {
      return res.status(503).json({ error: { code: 'AI_DISABLED', message: 'Akıllı öneriler şu anda kapalı' } });
    }
    const result = await useCases.suggestAiShoppingItems({
      householdId: req.params.householdId,
      userId: req.user.id,
    });
    res.json(result);
  }));

  router.post('/from-text', rateLimiter({ windowMs: 60_000, maxRequests: 3, keyFn: (req) => req.user.id }), asyncHandler(async (req, res) => {
    if (!useCases.addShoppingItemsFromText) {
      return res.status(503).json({ error: { code: 'AI_DISABLED', message: 'Akıllı öneriler şu anda kapalı' } });
    }
    const result = await useCases.addShoppingItemsFromText({
      householdId: req.params.householdId,
      text: req.body?.text,
    });
    res.json(result);
  }));

  // /items/reorder mutlaka /items/:itemId'den ÖNCE tanımlanmalı, yoksa
  // "reorder" bir itemId sanılır (tarif tarafında /suggestions'ın
  // /:recipeId'den önce gelmesiyle aynı tuzak).
  router.post('/items/reorder', asyncHandler(async (req, res) => {
    const { orderedIds } = req.body ?? {};
    if (!Array.isArray(orderedIds)) {
      throw new ValidationError('orderedIds bir dizi olmalı');
    }
    const { list } = await useCases.getShoppingList({ householdId: req.params.householdId, userId: req.user.id });
    await repos.shoppingListRepo.reorder({ shoppingListId: list.id, orderedIds });
    const items = await repos.shoppingListRepo.listItems(list.id);
    res.json({ items });
  }));

  router.post('/items', asyncHandler(async (req, res) => {
    const { productId, customName, quantity, unit, note, source } = req.body ?? {};
    const item = await useCases.addShoppingItem({
      householdId: req.params.householdId,
      userId: req.user.id,
      productId: productId ?? null,
      customName: customName ?? null,
      quantity: quantity ?? 1,
      unit: unit ?? 'piece',
      note: note ?? null,
      source: source ?? 'manual',
    });
    res.status(201).json({ item });
  }));

  router.patch('/items/:itemId', asyncHandler(async (req, res) => {
    const item = await repos.shoppingListRepo.updateItem(req.params.itemId, {
      quantity: req.body.quantity,
      unit: req.body.unit,
      note: req.body.note,
      isChecked: req.body.isChecked,
      checkedBy: req.body.isChecked ? req.user.id : undefined,
    });
    res.json({ item });
  }));

  router.delete('/items/:itemId', asyncHandler(async (req, res) => {
    await repos.shoppingListRepo.removeItem(req.params.itemId);
    res.status(204).end();
  }));

  router.delete('/checked', asyncHandler(async (req, res) => {
    const { list } = await useCases.getShoppingList({ householdId: req.params.householdId, userId: req.user.id });
    const removed = await repos.shoppingListRepo.clearChecked(list.id);
    res.json({ removed });
  }));

  router.post('/from-recipe/:recipeId', asyncHandler(async (req, res) => {
    const result = await useCases.addRecipeMissingToList({
      recipeId: req.params.recipeId,
      householdId: req.params.householdId,
      userId: req.user.id,
    });
    res.json(result);
  }));

  router.post('/transfer', asyncHandler(async (req, res) => {
    const { storageLocationId, expiresAt } = req.body ?? {};
    const result = await useCases.transferCheckedToInventory({
      householdId: req.params.householdId,
      storageLocationId,
      expiresAt: expiresAt ?? null,
      actorUserId: req.user.id,
    });
    res.json(result);
  }));

  return router;
};

export { buildShoppingRouter };
