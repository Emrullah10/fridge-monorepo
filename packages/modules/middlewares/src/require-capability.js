// requireHouseholdFeature ile AYNI desen — canUseAiFeature (domain'in saf
// fonksiyonu) enjekte edilir, middlewares paketi domain'e DOĞRUDAN bağımlı
// olmaz (hexagonal kısıt, require-household-feature.js'teki resolveFeatures
// enjeksiyonuyla birebir aynı yön). Bir AI ucunun kota/plan kontrolünü yapar
// VE geçerse kotayı rezerve eder — bu yüzden requireHouseholdFeature'dan
// SONRA, rateLimiter'dan ÖNCE takılmalı (plan yetersizliği 402, hız
// limitinden 429'dan önce dönmeli, bkz. plan §Faz 1 "Bağlanma noktaları").
//
// 401 KULLANILMAZ — auth_interceptor.dart 401'de refresh+retry yapıyor,
// 402 kullanmak sonsuz döngüyü engeller (bkz. plan notu).
//
// refIdFrom: request'ten idempotency anahtarını çıkarır (varsayılan: yoksa
// üretilir — senkron akışlarda örn. recipe/chef/shopping'te her istek zaten
// tek seferlik, scanId gibi paylaşılan bir kimlik yok). Fiş tarama akışında
// (asenkron) route katmanı scanId'yi refIdFrom ile geçirir.
const requireCapability = (feature, { getEntitlements, reserveAiUsage, canUseAiFeature, refIdFrom = () => null }) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const entitlements = await getEntitlements({ userId, platform: req.clientPlatform });
      const { allowed, reason } = canUseAiFeature(entitlements, feature);

      if (!allowed) {
        const quota = entitlements.quotas[feature];
        const status = 402;
        return res.status(status).json({
          error: { code: reason, message: describeReason(reason) },
          plan: entitlements.plan,
          feature,
          limit: quota?.limit ?? null,
          used: quota?.used ?? null,
          resetsAt: quota?.resetsAt ?? null,
          upgradeAvailable: entitlements.plan !== 'premium',
        });
      }

      const refId = refIdFrom(req) ?? `${feature}:${userId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      req.aiUsageRefId = refId;
      await reserveAiUsage({ refId, userId, feature });

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

const describeReason = (reason) => {
  switch (reason) {
    case 'SIGNUP_REQUIRED':
      return 'Bu özellik için ücretsiz hesap açman gerekiyor.';
    case 'PLAN_LIMIT_REACHED':
      return 'Bu ayki kullanım hakkını doldurdun.';
    case 'PLAN_FEATURE_LOCKED':
      return 'Bu özellik mevcut planında yok.';
    default:
      return 'Bu özelliğe şu an erişemiyorsun.';
  }
};

export { requireCapability };
