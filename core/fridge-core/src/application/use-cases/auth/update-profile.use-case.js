import { ValidationError } from '@fridge/errors';

// Şu an sadece displayName/locale — email değişimi kapsam dışı (yeniden
// doğrulama akışı gerektirir, ayrı bir iş).
const makeUpdateProfile = ({ userRepo }) => {
  return async ({ userId, displayName, locale }) => {
    if (typeof displayName !== 'string' || displayName.trim().length === 0) {
      throw new ValidationError('Ad soyad gerekli');
    }
    return userRepo.update(userId, { displayName: displayName.trim(), locale: locale ?? 'tr' });
  };
};

export { makeUpdateProfile };
