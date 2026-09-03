import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { requireAuth } from '@fridge/middlewares';

// GET /api/me/entitlements — mobilin tek doğruluk kaynağı (plan §Mimari
// ilke). RevenueCat webhook'u da burada, ama authenticate'ten ÖNCE mount
// edilir (bkz. boot.js, public route bloğu) — RC bizim JWT'mizi bilmez.
const buildBillingRouter = ({ container }) => {
  const router = Router();
  const { useCases } = container;

  router.get('/me/entitlements', requireAuth(), asyncHandler(async (req, res) => {
    const entitlements = await useCases.getEntitlements({ userId: req.user.id });
    res.json(entitlements);
  }));

  // Play'in 2026 zorunluluğu: uygulama içinden en fazla 2 dokunuşta iptal
  // (plan §Faz 5). Deep link üretimi tek satır — mağaza tarafında hiçbir
  // ek entegrasyon gerektirmiyor.
  router.get('/me/subscription/manage-url', requireAuth(), asyncHandler(async (req, res) => {
    const entitlements = await useCases.getEntitlements({ userId: req.user.id });
    const productId = entitlements.plan === 'premium' ? (req.query.productId ?? null) : null;
    const url = productId
      ? `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(productId)}&package=com.fridge.fridge_mobil`
      : 'https://play.google.com/store/account/subscriptions';
    res.json({ url });
  }));

  return router;
};

export { buildBillingRouter };
