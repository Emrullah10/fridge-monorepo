import { ForbiddenError, NotFoundError } from '@fridge/errors';

// requireHouseholdRole ile aynı desen — bir alanın belirli bir özelliği (şu
// an sadece 'food': tarifler + AI Chef) açık değilse 403 döner. Sadece
// mobil tarafta navbar'ı gizlemek yetmez: sunucu da uygulamalı, aksi halde
// yemek özelliği kapalı bir alanda bile /recipe, /chef uçlarına doğrudan
// istek atılabilir.
//
// `resolveFeatures` domain katmanından (household-profile.js) enjekte
// edilir — middlewares paketi domain'e bağımlı olmasın diye (hexagonal
// kısıt, name-confidence.js/brand-category-hints.js dersiyle aynı yön).
const requireHouseholdFeature = (featureKey, { householdRepo, resolveFeatures, paramName = 'householdId' }) => {
  return async (req, res, next) => {
    try {
      const householdId = req.params[paramName];
      const household = await householdRepo.findById(householdId);
      if (!household) {
        throw new NotFoundError('Household not found');
      }
      const features = resolveFeatures(household);
      if (!features[featureKey]) {
        throw new ForbiddenError(`Bu alanda "${featureKey}" özelliği kapalı`);
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export { requireHouseholdFeature };
