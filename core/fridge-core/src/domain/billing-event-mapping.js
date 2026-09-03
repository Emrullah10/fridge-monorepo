// RevenueCat webhook event type -> bizim subscription.status sözlüğümüz.
// RC event tipleri: INITIAL_PURCHASE, RENEWAL, CANCELLATION, UNCANCELLATION,
// BILLING_ISSUE, PRODUCT_CHANGE, EXPIRATION, REFUND/REVOKED (bkz. RC docs +
// Play RTDN 13 durumu, plan §Faz 5). Bu saf eşleme fonksiyonu domain'de
// yaşar — apply-billing-event.use-case.js sadece I/O yapar.
//
// KRİTİK: RC webhook payload'ı asla TEK BAŞINA doğruluk kaynağı sayılmaz —
// event sırası bozulabilir/tekrar gelebilir (bkz. billing_event.event_id
// idempotency). Bu yüzden burası sadece "bu event geldiğinde HANGİ duruma
// geçmeliyiz" haritasını taşır; asıl doğrulama use-case'te RC API'den taze
// veri (entitlement/subscriber) çekilerek yapılır (plan'da not edilen
// "RC'den TAZE durum çek" adımı — bu modül o adımın girdisini hazırlar).
const EVENT_TYPE_TO_STATUS = Object.freeze({
  INITIAL_PURCHASE: 'active',
  RENEWAL: 'active',
  UNCANCELLATION: 'active',
  PRODUCT_CHANGE: 'active',
  CANCELLATION: 'canceled',       // current_period_end'e kadar erişim (Play davranışı)
  BILLING_ISSUE: 'in_grace',
  EXPIRATION: 'expired',
  REFUND: 'revoked',
  REVOKED: 'revoked',
  PAUSED: 'paused',
  SUBSCRIPTION_PAUSED: 'paused',
  TRANSFER: 'expired',            // eski kullanıcıdan alınır — yeni kullanıcı ayrı bir INITIAL_PURCHASE ile gelir
});

// Bilinmeyen/yeni bir RC event tipi gelirse (RC yeni bir tip eklerse)
// sessizce durumu DEĞİŞTİRME — güvenli tarafta kal, sadece logla. Bir 500
// yerine "işlenmedi" dönmek daha doğru, RC zaten retry eder.
const resolveStatusForEventType = (eventType) => EVENT_TYPE_TO_STATUS[eventType] ?? null;

export { EVENT_TYPE_TO_STATUS, resolveStatusForEventType };
