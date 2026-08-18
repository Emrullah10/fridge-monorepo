// household.kind ile aynı enum (db-schemas/00-extensions-enums.sql). Bilinmeyen
// bir değer DB'de enum hatasına yol açacağı için burada 'other'a düşürülür.
const HOUSEHOLD_KINDS = ['home', 'office', 'summerhouse', 'other'];

const DEFAULT_LOCATIONS = [
  { name: 'Buzdolabı', kind: 'fridge', sortOrder: 0 },
  { name: 'Dondurucu', kind: 'freezer', sortOrder: 1 },
  { name: 'Kiler', kind: 'pantry', sortOrder: 2 },
];

const makeCreateHousehold = ({ householdRepo, householdMemberRepo, storageLocationRepo }) => {
  return async ({ name, kind, ownerUserId }) => {
    const safeKind = HOUSEHOLD_KINDS.includes(kind) ? kind : 'home';
    const household = await householdRepo.create({ name, kind: safeKind, createdBy: ownerUserId });

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

export { makeCreateHousehold, DEFAULT_LOCATIONS, HOUSEHOLD_KINDS };
