import bcrypt from 'bcryptjs';
import { ValidationError } from '@fridge/errors';
import { EmailAlreadyRegisteredError } from '../../../domain/errors/index.js';

// Misafir hesabını kalıcı hesaba yükseltir — AYNI satır UPDATE edilir
// (user.repository.js upgradeGuestToRegistered), household/inventory/
// receipt hiç taşınmaz çünkü zaten aynı user_id. Oturum korunur, yeni
// token üretilmez — çağıran zaten authenticated.
const makeUpgradeGuestUser = ({ userRepo }) => {
  return async ({ userId, isGuest, email, password, displayName }) => {
    if (!isGuest) {
      throw new ValidationError('Bu hesap zaten kalıcı');
    }

    const existing = await userRepo.findByEmail(email);
    if (existing && existing.id !== userId) {
      throw new EmailAlreadyRegisteredError(email);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    return userRepo.upgradeGuestToRegistered(userId, { email, passwordHash, displayName });
  };
};

export { makeUpgradeGuestUser };
