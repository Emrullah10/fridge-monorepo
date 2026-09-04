import { resolveStatusForEventType } from '../../../domain/billing-event-mapping.js';
import { resolveProductTier } from '../../../domain/plans.js';

// RevenueCat webhook handler'ı tarafından çağrılır. İdempotent: aynı
// event_id iki kez gelirse (RC retry, ağ tekrarı) ikinci çağrı erken döner
// (billing_event.recordIfNew false döner). rc_app_user_id === bizim
// user.id (Purchases.logIn(userId) ile mobilde sabitlenir, plan §Faz 5) —
// başka bir kullanıcıya ait bir purchase_token'sa (hesap paylaşımı/hata)
// SUBSCRIPTION_ALREADY_LINKED ile reddedilir, sessizce üstüne yazılmaz.
//
// productTiersByProductId: plans.js buildProductTiers() çıktısı (bkz.
// container.js) — resolveProductTier'a enjekte edilir, bu dosya PRODUCT_TIERS
// sabitine doğrudan bağımlı kalmaz (PLAN_LIMITS_JSON/PRODUCT_TIERS_JSON ile
// aynı ilke: sunucu restart'ıyla ezilebilir kalması gerekir).
const makeApplyBillingEvent = ({ billingEventRepo, subscriptionRepo, userRepo, productTiersByProductId }) => {
  return async ({ eventId, eventType, appUserId, productId, purchaseToken, environment = 'production', raw = null }) => {
    const isNew = await billingEventRepo.recordIfNew({ eventId, userId: appUserId, type: eventType, payload: raw });
    if (!isNew) {
      return { applied: false, reason: 'DUPLICATE_EVENT' };
    }

    const status = resolveStatusForEventType(eventType);
    if (!status) {
      // Bilinmeyen event tipi — kaydedildi (audit trail) ama durum
      // değiştirilmedi. RC yeni bir event tipi eklerse boot çökmez.
      return { applied: false, reason: 'UNKNOWN_EVENT_TYPE' };
    }

    const user = await userRepo.findById(appUserId);
    if (!user) {
      return { applied: false, reason: 'USER_NOT_FOUND' };
    }

    // Aynı purchase_token başka bir kullanıcıya bağlıysa (nadiren — hesap
    // paylaşımı ya da yanlış obfuscatedAccountId eşleşmesi) üstüne yazma.
    if (purchaseToken) {
      const existing = await subscriptionRepo.findByPurchaseToken(purchaseToken);
      if (existing && existing.userId !== appUserId) {
        return { applied: false, reason: 'SUBSCRIPTION_ALREADY_LINKED' };
      }
    }

    // productId boşsa (bazı CANCELLATION/EXPIRATION event'lerinde olur,
    // bkz. 24. migration) resolveProductTier'a hiç girmiyoruz — planTier/
    // seats null geçilir, subscriptionRepo.upsert bunu "kademe bilgisi bu
    // event'te yok" olarak yorumlar ve mevcut satırın kademesini korur
    // (bkz. subscription.repository.js upsert yorumu). productId doluysa
    // bilinmeyen bir SKU olsa bile resolveProductTier güvenli tarafta
    // (INDIVIDUAL/null) döner — hiçbir zaman throw etmez.
    const productTier = productId ? resolveProductTier(productId, productTiersByProductId) : null;

    // NOT: raw.currentPeriodEnd/store gibi alanlar RC webhook payload'ından
    // (event.expiration_at_ms, event.store vb.) mapper'a girmeden önce
    // normalize edilmiş olmalı — bu use-case'in imzası zaten normalize
    // edilmiş alanları bekler (mobil/webhook route katmanı RC'nin ham JSON'ını
    // buraya çevirmeden önce map eder, bu dosya RC'nin şemasına bağımlı
    // kalmasın diye).
    const subscription = await subscriptionRepo.upsert({
      userId: appUserId,
      store: raw?.store ?? 'play',
      productId,
      purchaseToken,
      rcAppUserId: appUserId,
      status,
      autoRenewing: status === 'active' || status === 'in_grace',
      currentPeriodEnd: raw?.currentPeriodEnd ?? null,
      canceledAt: status === 'canceled' ? new Date() : null,
      cancelReason: raw?.cancelReason ?? null,
      environment,
      raw,
      planTier: productTier?.tier ?? null,
      seats: productTier?.seats ?? null,
    });

    return { applied: true, subscription };
  };
};

export { makeApplyBillingEvent };
