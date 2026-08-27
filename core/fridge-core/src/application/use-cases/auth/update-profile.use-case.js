import { ValidationError } from '@fridge/errors';

const DIETS = new Set(['none', 'vegetarian', 'vegan', 'pescatarian', 'halal', 'kosher', 'glutenfree', 'lactosefree']);

// dietProfile normalize: geçersiz diyet 'none'a düşer (DB'ye serbest jsonb
// yazıyoruz ama tutarlılık için whitelist), allergens string dizisine
// zorlanır, dailyKcalTarget pozitif sayı ya da null.
const normalizeDietProfile = (raw) => {
  if (raw === null) return null; // açıkça temizle
  if (typeof raw !== 'object') return undefined; // dokunma
  const allergens = Array.isArray(raw.allergens)
    ? raw.allergens.filter((a) => typeof a === 'string' && a.trim()).map((a) => a.trim())
    : [];
  const diet = DIETS.has(raw.diet) ? raw.diet : 'none';
  const kcal = Number(raw.dailyKcalTarget);
  const dailyKcalTarget = Number.isFinite(kcal) && kcal > 0 ? Math.round(kcal) : null;
  return { allergens, diet, dailyKcalTarget };
};

// displayName/locale + diyet profili. email değişimi kapsam dışı (yeniden
// doğrulama akışı gerektirir, ayrı bir iş).
const makeUpdateProfile = ({ userRepo }) => {
  return async ({ userId, displayName, locale, dietProfile }) => {
    if (typeof displayName !== 'string' || displayName.trim().length === 0) {
      throw new ValidationError('Ad soyad gerekli');
    }
    return userRepo.update(userId, {
      displayName: displayName.trim(),
      locale: locale ?? 'tr',
      // undefined => dokunma, null => temizle, obje => normalize et
      dietProfile: dietProfile === undefined ? undefined : normalizeDietProfile(dietProfile),
    });
  };
};

export { makeUpdateProfile };
