// Alan (household) türünün hangi özellikleri (tarifler, AI Chef) varsayılan
// olarak açtığını ve yeni bir alan açılırken hangi bölümlerin oluşturulacağını
// belirler — storage-kinds.js'teki CHECK kısıtının tek doğruluk kaynağı
// olması gibi, bu da tür→davranış eşlemesinin tek kaynağı.
//
// Konsept sadece yemek/ev değil (cerebrum 2026-08-18: kodda `household`,
// ekranda "alan") — bir atölye/dükkan/garaj alanı da olabiliyor, o alanlarda
// Tarifler/AI Chef anlamsız. `household.features` JSONB kullanıcının bu
// varsayımı EZMESİNE izin verir (ör. "ofiste mutfağımız var, tarif
// istiyorum") — kayıtlı bir `food` alanı varsa o kullanılır, yoksa türden
// türetilir.

// Yemeğin doğal olarak bulunduğu alan türleri.
const FOOD_KINDS = new Set(['home', 'summerhouse', 'cottage', 'dorm', 'boat']);

const defaultFeaturesForKind = (kind) => ({ food: FOOD_KINDS.has(kind) });

// household.features (JSONB, DB'den gelen ham obje) + kind'i alır, kesin
// özellik durumunu döner. `features.food` açıkça true/false ise o kullanılır
// (kullanıcı kararı), tanımsızsa türden türetilir. `icon` kullanıcının seçtiği
// serbest simge anahtarı (mobil `householdIconChoices`); yoksa null — istemci
// eski kayıtlarda `kind`'ın varsayılan ikonuna düşer.
const resolveFeatures = (household) => {
  const stored = household?.features ?? {};
  const food = typeof stored.food === 'boolean' ? stored.food : FOOD_KINDS.has(household?.kind);
  const icon = typeof stored.icon === 'string' ? stored.icon : null;
  return { food, icon };
};

// Her alan türü için varsayılan bölüm listesi (create-household.use-case.js
// eskiden tek bir DEFAULT_LOCATIONS sabiti kullanıyordu — hepsi Buzdolabı/
// Dondurucu/Kiler'di, bir atölye alanı da mutfak bölümleriyle açılıyordu).
// Hepsi mevcut chk_storage_location_kind CHECK listesinden seçildi
// (07-storage-kind-text.sql) — yeni bir storage kind değeri EKLENMEDİ.
const DEFAULT_LOCATIONS_BY_KIND = {
  home: [
    { name: 'Buzdolabı', kind: 'fridge', sortOrder: 0 },
    { name: 'Dondurucu', kind: 'freezer', sortOrder: 1 },
    { name: 'Kiler', kind: 'pantry', sortOrder: 2 },
  ],
  summerhouse: [
    { name: 'Buzdolabı', kind: 'fridge', sortOrder: 0 },
    { name: 'Dondurucu', kind: 'freezer', sortOrder: 1 },
    { name: 'Kiler', kind: 'pantry', sortOrder: 2 },
  ],
  cottage: [
    { name: 'Buzdolabı', kind: 'fridge', sortOrder: 0 },
    { name: 'Dondurucu', kind: 'freezer', sortOrder: 1 },
    { name: 'Kiler', kind: 'pantry', sortOrder: 2 },
  ],
  dorm: [
    { name: 'Buzdolabı', kind: 'fridge', sortOrder: 0 },
    { name: 'Dondurucu', kind: 'freezer', sortOrder: 1 },
    { name: 'Kiler', kind: 'pantry', sortOrder: 2 },
  ],
  boat: [
    { name: 'Buzdolabı', kind: 'fridge', sortOrder: 0 },
    { name: 'Dondurucu', kind: 'freezer', sortOrder: 1 },
    { name: 'Kiler', kind: 'pantry', sortOrder: 2 },
  ],
  office: [
    { name: 'Buzdolabı', kind: 'fridge', sortOrder: 0 },
    { name: 'Dolap', kind: 'cabinet', sortOrder: 1 },
    { name: 'Depo', kind: 'cellar', sortOrder: 2 },
  ],
  workshop: [
    { name: 'Raf', kind: 'shelf', sortOrder: 0 },
    { name: 'Çekmece', kind: 'drawer', sortOrder: 1 },
    { name: 'Kutu', kind: 'box', sortOrder: 2 },
  ],
  shop: [
    { name: 'Depo', kind: 'cellar', sortOrder: 0 },
    { name: 'Raf', kind: 'shelf', sortOrder: 1 },
    { name: 'Buzdolabı', kind: 'fridge', sortOrder: 2 },
  ],
  garage: [
    { name: 'Raf', kind: 'shelf', sortOrder: 0 },
    { name: 'Dolap', kind: 'cabinet', sortOrder: 1 },
    { name: 'Kutu', kind: 'box', sortOrder: 2 },
  ],
  other: [
    { name: 'Raf', kind: 'shelf', sortOrder: 0 },
    { name: 'Dolap', kind: 'cabinet', sortOrder: 1 },
    { name: 'Kutu', kind: 'box', sortOrder: 2 },
  ],
};

const defaultLocationsForKind = (kind) => DEFAULT_LOCATIONS_BY_KIND[kind] ?? DEFAULT_LOCATIONS_BY_KIND.other;

export { FOOD_KINDS, defaultFeaturesForKind, resolveFeatures, DEFAULT_LOCATIONS_BY_KIND, defaultLocationsForKind };
