import { HOUSEHOLD_KINDS } from '../../../domain/storage-kinds.js';
import { defaultFeaturesForKind } from '../../../domain/household-profile.js';

// Yeni alanlar artık arayüzde tür seçmiyor (bkz. household_kind.dart — serbest
// simge seçimine geçildi), bu yüzden hepsi aynı bölümlerle açılır. Tür-bazlı
// DEFAULT_LOCATIONS_BY_KIND hâlâ domain'de duruyor (test + eski kayıt yolu),
// ama create yolu bu sabiti kullanır.
const DEFAULT_LOCATIONS = [
  { name: 'Buzdolabı', kind: 'fridge', sortOrder: 0 },
  { name: 'Dondurucu', kind: 'freezer', sortOrder: 1 },
  { name: 'Kiler', kind: 'pantry', sortOrder: 2 },
];

const makeCreateHousehold = ({ householdRepo, householdMemberRepo, storageLocationRepo }) => {
  return async ({ name, kind, ownerUserId, features }) => {
    // İstemci `kind` göndermez; misafir yolu (create-guest-user.use-case.js)
    // açıkça 'home' geçer. Bilinmeyen/eksik değer 'other'e düşer.
    const safeKind = HOUSEHOLD_KINDS.includes(kind) ? kind : 'other';
    // features kullanıcı tarafından açıkça verilmediyse türden türetilir
    // (household-profile.js). Kullanıcı "food" anahtarını ezmiş olabilir —
    // ör. ofis alanında mutfak özelliklerini açık isteyebilir. `icon` serbest
    // simge anahtarı, string ise korunur.
    const safeFeatures = { ...defaultFeaturesForKind(safeKind) };
    if (features && typeof features.food === 'boolean') safeFeatures.food = features.food;
    if (features && typeof features.icon === 'string') safeFeatures.icon = features.icon;

    const household = await householdRepo.create({
      name,
      kind: safeKind,
      features: safeFeatures,
      createdBy: ownerUserId,
    });

    await householdMemberRepo.addMember({
      householdId: household.id,
      userId: ownerUserId,
      role: 'owner',
    });

    for (const location of DEFAULT_LOCATIONS) {
      await storageLocationRepo.create({ householdId: household.id, ...location });
    }

    return household;
  };
};

export { makeCreateHousehold, HOUSEHOLD_KINDS };
