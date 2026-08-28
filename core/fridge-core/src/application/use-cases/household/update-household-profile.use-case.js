import { NotFoundError, ValidationError } from '@fridge/errors';

// Alanın adını ve/veya serbest simgesini (features.icon) günceller. Tür
// (household.kind) arayüzden kalktığı için burada değiştirilmez — eski
// kayıtlarda olduğu gibi kalır. Yemek özelliği ayrı endpoint'te
// (update-household-features.use-case.js) yönetilir, buraya karışmaz.
const makeUpdateHouseholdProfile = ({ householdRepo }) => {
  return async ({ householdId, name, icon }) => {
    const household = await householdRepo.findById(householdId);
    if (!household) {
      throw new NotFoundError('Household not found');
    }

    const trimmed = typeof name === 'string' ? name.trim() : undefined;
    if (trimmed !== undefined && trimmed.length === 0) {
      throw new ValidationError('Alan adı boş olamaz');
    }

    const features = typeof icon === 'string'
      ? { ...household.features, icon }
      : undefined;

    return householdRepo.updateProfile(householdId, { name: trimmed, features });
  };
};

export { makeUpdateHouseholdProfile };
