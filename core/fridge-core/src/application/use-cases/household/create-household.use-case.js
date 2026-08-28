import { HOUSEHOLD_KINDS } from '../../../domain/storage-kinds.js';
import { defaultFeaturesForKind, defaultLocationsForKind } from '../../../domain/household-profile.js';

const makeCreateHousehold = ({ householdRepo, householdMemberRepo, storageLocationRepo }) => {
  return async ({ name, kind, ownerUserId, features }) => {
    const safeKind = HOUSEHOLD_KINDS.includes(kind) ? kind : 'home';
    // features kullanıcı tarafından açıkça verilmediyse türden türetilir
    // (household-profile.js). Kullanıcı "food" anahtarını ezmiş olabilir —
    // ör. ofis alanında mutfak özelliklerini açık isteyebilir.
    const safeFeatures = features && typeof features.food === 'boolean'
      ? { food: features.food }
      : defaultFeaturesForKind(safeKind);
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

    for (const location of defaultLocationsForKind(safeKind)) {
      await storageLocationRepo.create({ householdId: household.id, ...location });
    }

    return household;
  };
};

export { makeCreateHousehold, HOUSEHOLD_KINDS };
