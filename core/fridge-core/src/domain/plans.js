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

// NOT (bkz. plan §Faz B "teyit edilecek nokta"): expiryNotify şu an sadece
// GUEST'te false, FREE/TRIAL/PREMIUM'un hepsinde true — yani "premium'da var"
// diye satılan bir avantaj değil, sadece misafirde kapalı bir demo-mod
// kısıtı. Gerçek SKT bildirim işi/zamanlayıcısı henüz yok; bu alan bugün
// hiçbir kapı gerektirmiyor. features.export ise PREMIUM/TRIAL'da satılan
// gerçek bir avantaj — export-inventory-csv.use-case.js + requirePlanFeature
// ile karşılığı var (bkz. inventory.routes.js).
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

// Platform bazlı limitler (bkz. plan §Faz D) — BASE_LIMITS ANDROID kabul
// edilir (mobilin çoğunluğu, henüz iOS sürümü yok). PLATFORM_OVERRIDES.ios
// SADECE değişecek alanları taşır, deep-merge ile BASE_LIMITS'in üstüne
// biner — "iOS'ta Android'den daha cömert olamaz" kuralı burada, sayılar
// PLATFORM_LIMITS_JSON env'i ile PLAN_LIMITS_JSON'la BİREBİR AYNI desende
// ezilebilir. Şimdilik boş: ilk iOS sürümü çıkarken buraya gerçek kısıtlar
// eklenecek (bkz. plan §Faz D — "Android'in iOS'tan daha cömert olması").
const PLATFORM_OVERRIDES = Object.freeze({
  ios: {},
});

// Aile paketi (YouTube Family tarzı) — RC ürün kimliğinden kademe/koltuk
// sayısını çözer. Tek entitlement ("premium") üzerinden çalışıyoruz; kademe
// SADECE bizim tarafımızda anlamlı, RC'ye hiç bildirilmez (bkz.
// billing-event-mapping.js). Koltuk sayısını AAB yüklemeden değiştirebilmek
// için PRODUCT_TIERS_JSON env'i ile PLAN_LIMITS_JSON'la BİREBİR AYNI desende
// ezilebilir tutulur.
const PLAN_TIER = Object.freeze({
  INDIVIDUAL: 'individual',
  FAMILY: 'family',
});

const PRODUCT_TIERS = Object.freeze({
  fridge_premium_monthly: { tier: PLAN_TIER.INDIVIDUAL, seats: null },
  fridge_premium_annual: { tier: PLAN_TIER.INDIVIDUAL, seats: null },
  fridge_premium_family_monthly: { tier: PLAN_TIER.FAMILY, seats: 5 },
  fridge_premium_family_annual: { tier: PLAN_TIER.FAMILY, seats: 5 },
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
//
// platform: 'android' | 'ios' — android'de PLATFORM_OVERRIDES hiç
// uygulanmaz (BASE_LIMITS zaten Android kabul edilir), ios'ta önce
// PLATFORM_OVERRIDES.ios sonra platformLimitsJsonOverrides (PLATFORM_
// LIMITS_JSON env'i, sadece o platforma özel ek ezme) sırayla biner.
const buildPlanLimits = (rawOverridesJson = null, platform = 'android', rawPlatformOverridesJson = null) => {
  const overrides = loadLimitOverrides(rawOverridesJson);
  const platformOverrides = platform === 'ios' ? PLATFORM_OVERRIDES.ios : {};
  const platformJsonOverrides = loadLimitOverrides(rawPlatformOverridesJson)?.[platform] ?? {};
  const merged = {};
  for (const plan of Object.values(PLAN)) {
    let planLimits = deepMerge(BASE_LIMITS[plan], overrides[plan]);
    planLimits = deepMerge(planLimits, platformOverrides[plan]);
    planLimits = deepMerge(planLimits, platformJsonOverrides[plan]);
    merged[plan] = planLimits;
  }
  return Object.freeze(merged);
};

// PRODUCT_TIERS_JSON="{\"fridge_premium_family_monthly\":{\"seats\":6}}" ile
// tek bir ürünün koltuk sayısı bile tek başına ezilebilir — buildPlanLimits
// ile aynı deep-merge deseni, aynı "bozuk JSON'da sessizce base'e düş" ilkesi.
const buildProductTiers = (rawOverridesJson = null) => {
  const overrides = loadLimitOverrides(rawOverridesJson);
  const merged = {};
  for (const productId of Object.keys(PRODUCT_TIERS)) {
    merged[productId] = deepMerge(PRODUCT_TIERS[productId], overrides[productId]);
  }
  return Object.freeze(merged);
};

// Bilinmeyen bir product_id (RC'de test/deneme ürünü, ya da henüz haritaya
// eklenmemiş yeni bir SKU) INDIVIDUAL'a güvenli tarafta düşer — aile
// koltuğu sessizce herkese açılmasın diye "tanımadığım ürün = tek koltuk".
const resolveProductTier = (productId, productTiersByProductId) =>
  productTiersByProductId[productId] ?? { tier: PLAN_TIER.INDIVIDUAL, seats: null };

export {
  PLAN,
  AI_FEATURES,
  HOUSEHOLD_BOOST_MULTIPLIER,
  BASE_LIMITS,
  PLATFORM_OVERRIDES,
  buildPlanLimits,
  PLAN_TIER,
  PRODUCT_TIERS,
  buildProductTiers,
  resolveProductTier,
};
