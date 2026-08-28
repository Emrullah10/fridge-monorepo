import { NotFoundError, ValidationError } from '@fridge/errors';

// Kullanıcının household-profile.js'teki tür varsayımını EZMESİ — ör. bir
// ofis alanında mutfak/tarif özelliklerini açık isteyebilir. Şu an için tek
// anahtar: food (tarifler + AI Chef). Yeni bir özellik eklenirse buraya ve
// domain/household-profile.js'e birlikte eklenmeli.
const makeUpdateHouseholdFeatures = ({ householdRepo }) => {
  return async ({ householdId, food }) => {
    if (typeof food !== 'boolean') {
      throw new ValidationError('food alanı boolean olmalı');
    }
    const household = await householdRepo.findById(householdId);
    if (!household) {
      throw new NotFoundError('Household not found');
    }
    return householdRepo.updateFeatures(householdId, { ...household.features, food });
  };
};

export { makeUpdateHouseholdFeatures };
