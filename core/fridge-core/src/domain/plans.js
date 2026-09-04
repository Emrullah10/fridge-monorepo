// Plan/kota tablosunun TEK doğruluk kaynağı. Uygulama sürümü çıkarmadan
// limit değiştirebilmek için (Play incelemesi günler sürüyor, kapalı test
// sırasında limit ayarlamak bir AAB yüklemesine bağlı olamaz) PLAN_LIMITS_JSON
// env değişkeniyle her alan tek tek ezilebilir — sunucu restart'ı yeterli.
//
// Değerler KASITLI OLARAK BOL — gerçek kullanım ai_usage_log ile ölçüldükten
// sonra (bkz. buglog bug-324, artık user_id/household_id dolduruluyor)
// veriye göre sıkılaştırılacak. Şu an "suistimal tavanı", pazarlama rakamı
// değil — kullanıcı arayüzünde "sınırsız" olarak sunulur.

const PLAN = Object.freeze({
  GUEST: 'guest',
  FREE: 'free',
  TRIAL: 'trial',
  PREMIUM: 'premium',
});

const AI_FEATURES = Object.freeze(['receipt', 'recipe', 'chef', 'shopping']);

// household.owner planına göre ÜCRETSİZ üyeye tanınan çarpan — "Karma"
// paylaşım modeli: AI kotası kişisel kalır ama premium alanın ücretsiz
// üyesi 2 katı kota alır. Yapısal limitler (bölüm/üye/geçmiş) ayrıca
// households.<id>.ownerPlan üzerinden AYRI çözülür (bkz. entitlements.js).
const HOUSEHOLD_BOOST_MULTIPLIER = 2;

const BASE_LIMITS = Object.freeze({
  [PLAN.GUEST]: {
    ai: { receipt: 0, recipe: 0, chef: 0, shopping: 0 }, // demo mod — Gemini hiç çağrılmaz
    inventory: { itemsTotal: 30 },
    household: { count: 1 },
    location: { perHousehold: 3 },
    member: { perHousehold: 0 }, // davet gönderemez/kabul edemez
    insights: { windowDays: 7 },
    features: { barcode: false, export: false, expiryNotify: false },
  },
  [PLAN.FREE]: {
    ai: { receipt: 10, recipe: 15, chef: 20, shopping: 15 },
    inventory: { itemsTotal: null }, // sınırsız
    household: { count: 2 },
    location: { perHousehold: 6 },
    member: { perHousehold: 2 },
    insights: { windowDays: 30 },
    features: { barcode: true, export: false, expiryNotify: true },
  },
  [PLAN.TRIAL]: {
    ai: { receipt: 300, recipe: 500, chef: 1000, shopping: 500 },
    inventory: { itemsTotal: null },
    household: { count: 10 },
    location: { perHousehold: null },
    member: { perHousehold: 10 },
    insights: { windowDays: null },
    features: { barcode: true, export: true, expiryNotify: true },
  },
  [PLAN.PREMIUM]: {
    ai: { receipt: 300, recipe: 500, chef: 1000, shopping: 500 },
    inventory: { itemsTotal: null },
    household: { count: 10 },
    location: { perHousehold: null },
    member: { perHousehold: 10 },
    insights: { windowDays: null },
    features: { barcode: true, export: true, expiryNotify: true },
  },
});

// PLAN_LIMITS_JSON="{\"free\":{\"ai\":{\"receipt\":5}}}" gibi kısmi bir obje
// ile tek tek alan ezilebilir — deep merge, tüm ağacı yeniden yazmaya gerek
// yok. Bozuk JSON sessizce yok sayılır (yanlış env boot'u asla çökertmemeli,
// FCM/mail no-op adaptörleriyle aynı ilke).
const deepMerge = (base, override) => {
  if (!override || typeof override !== 'object') return base;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const value = override[key];
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? deepMerge(base?.[key] ?? {}, value)
      : value;
  }
  return result;
};

const loadLimitOverrides = (rawJson) => {
  if (!rawJson) return {};
  try {
    return JSON.parse(rawJson);
  } catch {
    return {};
  }
};

// Test edilebilirlik için env okuması dışa açık bırakılıyor — çağıran
// (container.js) process.env.PLAN_LIMITS_JSON'ı geçirir, bu modül process'e
// hiç dokunmaz (hexagonal kısıt: domain katmanı I/O yapmaz).
const buildPlanLimits = (rawOverridesJson = null) => {
  const overrides = loadLimitOverrides(rawOverridesJson);
  const merged = {};
  for (const plan of Object.values(PLAN)) {
    merged[plan] = deepMerge(BASE_LIMITS[plan], overrides[plan]);
  }
  return Object.freeze(merged);
};

export { PLAN, AI_FEATURES, HOUSEHOLD_BOOST_MULTIPLIER, BASE_LIMITS, buildPlanLimits };
