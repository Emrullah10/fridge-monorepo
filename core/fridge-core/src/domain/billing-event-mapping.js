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

// RC store alanı -> bizim subscription.store CHECK kısıtımız (play/
// app_store/promo). RC 'PLAY_STORE'/'AMAZON'/'APP_STORE'/'STRIPE' vb.
// döner — şimdilik sadece Play hedefleniyor (plan kapsamı), bilinmeyeni
// 'play' varsayımına düşürmek yerine olduğu gibi küçük harfe çeviriyoruz;
// CHECK kısıtı geçersiz bir değeri zaten DB seviyesinde reddeder (sessiz
// veri bozulması yerine gürültülü hata — kasıtlı).
const mapRcStoreToOurStore = (rcStore) => {
  if (rcStore === 'PLAY_STORE') return 'play';
  if (rcStore === 'APP_STORE') return 'app_store';
  return 'promo';
};

// RC webhook'unun ham JSON gövdesini (api_version + event) apply-billing-
// event.use-case.js'in beklediği normalize edilmiş şekle çevirir. RC'nin
// gerçek alan adları (event.app_user_id, event.expiration_at_ms, vb.) SADECE
// burada bilinir — use-case'in kendisi RC'nin şemasına hiç bağımlı değil
// (yorum: "bu use-case'in imzası zaten normalize edilmiş alanları bekler").
//
// event yoksa ya da temel alanlar eksikse null döner — çağıran (webhook
// route'u) bunu 400 olarak ele alır, RC'nin retry mekanizmasına güvenir.
const parseRevenueCatWebhookPayload = (body) => {
  const event = body?.event;
  if (!event || typeof event !== 'object') return null;
  if (!event.id || !event.type || !event.app_user_id) return null;

  return {
    eventId: event.id,
    eventType: event.type,
    appUserId: event.app_user_id,
    productId: event.product_id ?? null,
    purchaseToken: event.store_transaction_id ?? event.original_transaction_id ?? event.transaction_id ?? null,
    environment: event.environment === 'SANDBOX' ? 'sandbox' : 'production',
    raw: {
      store: mapRcStoreToOurStore(event.store),
      currentPeriodEnd: typeof event.expiration_at_ms === 'number' ? new Date(event.expiration_at_ms) : null,
      cancelReason: event.cancel_reason ?? null,
      periodType: event.period_type ?? null,
      rcEventId: event.id,
    },
  };
};

export { EVENT_TYPE_TO_STATUS, resolveStatusForEventType, mapRcStoreToOurStore, parseRevenueCatWebhookPayload };
