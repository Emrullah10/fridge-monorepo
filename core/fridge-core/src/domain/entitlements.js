// Kullanıcının o an neye erişimi olduğunu tek bir yerde çözer. Mobil hiçbir
// limiti kendi içinde tutmaz — GET /me/entitlements bu fonksiyonun çıktısını
// döner. Tüm uç durumlar (deneme, iptal-ama-dönem-bitmemiş, grace period,
// hesap beklemede, alan sahibinin planından gelen çarpan) BURADA yaşar ve
// BURADA test edilir — bu dosya planın en kritik test kümesidir.
//
// Saf fonksiyon: DB/HTTP'ye dokunmaz (hexagonal kısıt). Çağıran (use-case)
// user/subscription/householdOwnerPlans/now'ı hazırlar, sonuç mobilin
// /me/entitlements gövdesine neredeyse birebir map'lenir.

import { PLAN, AI_FEATURES, HOUSEHOLD_BOOST_MULTIPLIER } from './plans.js';

// Play/RevenueCat abonelik durumundan bizim durumumuza indirger. Grace
// period ve iptal-ama-dönem-bitmemiş ERİŞİM VERİR (bkz. Android Developers
// subscription lifecycle) — sadece on_hold/paused/expired/revoked kapatır.
const ACCESS_GRANTING_STATUSES = new Set(['active', 'in_grace', 'canceled']);

// subscription.status='canceled' olsa bile current_period_end'e kadar erişim
// açık kalır — Play'in kendi davranışı, ek kod gerekmiyor, sadece burada
// doğru yorumlanması gerekiyor. Dönem geçtiyse artık erişim yok.
const isSubscriptionCurrentlyActive = (subscription, now) => {
  if (!subscription) return false;
  if (!ACCESS_GRANTING_STATUSES.has(subscription.status)) return false;
  if (subscription.status === 'canceled' || subscription.status === 'in_grace') {
    // current_period_end yoksa (veri tutarsızlığı) güvenli tarafta kal — erişim verme.
    if (!subscription.currentPeriodEnd) return false;
    return new Date(subscription.currentPeriodEnd).getTime() > now.getTime();
  }
  return true; // 'active'
};

const isTrialActive = (user, now) => {
  if (!user?.trialEndsAt) return false;
  return new Date(user.trialEndsAt).getTime() > now.getTime();
};

// Misafir > aktif abonelik > aktif deneme > ücretsiz. Sıra önemli: bir
// kullanıcı hem eski bir deneme kaydına hem aktif aboneliğe sahip olabilir,
// abonelik her zaman kazanır (ör. deneme bittikten sonra abone oldu).
const resolvePlan = ({ user, subscription, now }) => {
  if (user?.isGuest) {
    return { plan: PLAN.GUEST, source: 'guest', status: 'active' };
  }
  if (isSubscriptionCurrentlyActive(subscription, now)) {
    return { plan: PLAN.PREMIUM, source: subscription.store, status: subscription.status };
  }
  // Abonelik kaydı var ama artık erişim vermiyor (on_hold/paused/expired/
  // revoked/dönem bitmiş) — durumu olduğu gibi yansıt, mobil buna göre
  // "ödemen alınamadı" / "duraklatıldı" ekranı gösterir.
  if (subscription && ['on_hold', 'paused', 'expired', 'revoked'].includes(subscription.status)) {
    if (isTrialActive(user, now)) {
      return { plan: PLAN.TRIAL, source: 'reverse_trial', status: 'active' };
    }
    return { plan: PLAN.FREE, source: subscription.store, status: subscription.status };
  }
  if (isTrialActive(user, now)) {
    return { plan: PLAN.TRIAL, source: 'reverse_trial', status: 'active' };
  }
  return { plan: PLAN.FREE, source: 'signup', status: 'active' };
};

// Bir kullanıcı birden fazla premium alanın üyesi olabilir — çarpan
// TOPLANMAZ, bir kez uygulanır (plan §"2x çarpan kuralı").
const hasAnyPremiumHouseholdMembership = (householdOwnerPlans) =>
  Object.values(householdOwnerPlans ?? {}).some((ownerPlan) => ownerPlan === PLAN.PREMIUM);

// AI kotaları: kullanıcının KENDİ planı esas, ama ücretsiz/deneme-dışı bir
// kullanıcı premium birinin alanındaysa 2x çarpan uygulanır ("Karma" model —
// kişisel kota + alan genişliği). Premium/deneme kullanıcı zaten en yüksek
// tavanda, çarpanın bir anlamı yok.
const resolveAiQuotaLimits = ({ plan, baseLimits, householdOwnerPlans }) => {
  const boosted = plan === PLAN.FREE && hasAnyPremiumHouseholdMembership(householdOwnerPlans);
  const limits = {};
  for (const feature of AI_FEATURES) {
    const base = baseLimits.ai[feature];
    limits[feature] = {
      limit: base === null || !boosted ? base : base * HOUSEHOLD_BOOST_MULTIPLIER,
      boosted: boosted && base !== null,
    };
  }
  return limits;
};

// Yapısal limitler (bölüm sayısı, üye sayısı, geçmiş penceresi) alanın
// SAHİBİNİN planından gelir, üyenin kendi planından değil — sahibi premium
// olan bir alanda ücretsiz üye de sınırsız bölüm/üye görür.
const resolveHouseholdLimits = ({ householdOwnerPlans, planLimitsByPlan }) => {
  const result = {};
  for (const [householdId, ownerPlan] of Object.entries(householdOwnerPlans ?? {})) {
    const limits = planLimitsByPlan[ownerPlan] ?? planLimitsByPlan[PLAN.FREE];
    result[householdId] = {
      ownerPlan,
      maxMembers: limits.member.perHousehold,
      maxLocations: limits.location.perHousehold,
      insightsWindowDays: limits.insights.windowDays,
    };
  }
  return result;
};

// used/resetsAt için usage-summary use-case'ten gelen veriyi olduğu gibi
// geçirir — bu fonksiyon sayaç OKUMAZ (I/O yok), sadece LİMİT hesaplar.
const attachUsage = (quotaLimits, usageByFeature) => {
  const result = {};
  for (const feature of AI_FEATURES) {
    const usage = usageByFeature?.[feature] ?? { used: 0, resetsAt: null };
    result[feature] = { ...quotaLimits[feature], used: usage.used, resetsAt: usage.resetsAt };
  }
  return result;
};

// planLimitsByPlan: buildPlanLimits() çıktısı (bkz. plans.js).
// householdOwnerPlans: { [householdId]: PLAN } — çağıran, kullanıcının üye
// olduğu her alanın SAHİBİNİN planını önceden çözüp geçirir.
// usageByFeature: { [feature]: { used, resetsAt } } — usage_counter'dan.
const resolveEntitlements = ({ user, subscription, householdOwnerPlans = {}, usageByFeature = {}, planLimitsByPlan, now = new Date() }) => {
  const { plan, source, status } = resolvePlan({ user, subscription, now });
  const baseLimits = planLimitsByPlan[plan];

  const quotaLimits = resolveAiQuotaLimits({ plan, baseLimits, householdOwnerPlans });
  const quotas = attachUsage(quotaLimits, usageByFeature);

  return {
    plan,
    source,
    status,
    trialEndsAt: user?.trialEndsAt ?? null,
    periodEndsAt: subscription?.currentPeriodEnd ?? null,
    features: baseLimits.features,
    quotas,
    households: resolveHouseholdLimits({ householdOwnerPlans, planLimitsByPlan }),
    // Kaç alanın SAHİBİ olabileceği — households (üye olunan alanlar
    // listesi) ile karıştırılmasın; bu, KULLANICININ kendi planından gelen
    // "yeni household oluşturabilir mi" limiti (requireStructuralLimit
    // 'household.count' burayı okur).
    householdCountLimit: baseLimits.household.count,
    // Envanter satırı toplam limiti (şu an sadece GUEST'te sayısal, diğer
    // planlarda null/sınırsız) — inventory ekleme ucunun kapısı için.
    inventoryItemsLimit: baseLimits.inventory.itemsTotal,
  };
};

// requireCapability middleware'inin doğrudan kullandığı kapı fonksiyonu —
// bir AI isteği bu anda geçebilir mi? Kota rezervasyonundan ÖNCE çağrılır.
const canUseAiFeature = (entitlements, feature) => {
  const quota = entitlements.quotas[feature];
  if (!quota) return { allowed: false, reason: 'UNKNOWN_FEATURE' };
  if (entitlements.plan === PLAN.GUEST) return { allowed: false, reason: 'SIGNUP_REQUIRED' };
  if (quota.limit !== null && quota.used >= quota.limit) return { allowed: false, reason: 'PLAN_LIMIT_REACHED' };
  return { allowed: true, reason: null };
};

export { resolveEntitlements, canUseAiFeature, isSubscriptionCurrentlyActive, isTrialActive, resolvePlan };
