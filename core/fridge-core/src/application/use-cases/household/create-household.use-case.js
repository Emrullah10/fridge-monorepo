const DEFAULT_LOCATIONS = [
  { name: 'Buzdolabı', kind: 'fridge', sortOrder: 0 },
  { name: 'Dondurucu', kind: 'freezer', sortOrder: 1 },
  { name: 'Kiler', kind: 'pantry', sortOrder: 2 },
];

const makeCreateHousehold = ({ householdRepo, householdMemberRepo, storageLocationRepo }) => {
  return async ({ name, ownerUserId }) => {
    const household = await householdRepo.create({ name, createdBy: ownerUserId });

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

export { makeCreateHousehold, DEFAULT_LOCATIONS };
