// Plan bazlı özellik kapısı (bkz. plans.js features: barcode/export/
// expiryNotify) — requireHouseholdFeature'dan FARKLI bir eksen: o alanın
// KENDİ ayarına bakar ('food' özelliği açık mı), bu KULLANICININ planına
// bakar. requireCapability'den farkı: kota rezervasyonu YOK, sadece
// açık/kapalı — kullanım sayılmayan özellikler için (bkz. plan §Faz B).
const requirePlanFeature = (featureKey, { getEntitlements }) => {
  return async (req, res, next) => {
    try {
      const entitlements = await getEntitlements({ userId: req.user.id, platform: req.clientPlatform });
      if (entitlements.features[featureKey]) return next();

      return res.status(402).json({
        error: { code: 'PLAN_FEATURE_LOCKED', message: 'Bu özellik mevcut planında yok.' },
        plan: entitlements.plan,
        feature: featureKey,
        upgradeAvailable: entitlements.plan !== 'premium',
      });
    } catch (error) {
      return next(error);
    }
  };
};

export { requirePlanFeature };
