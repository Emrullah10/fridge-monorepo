import bcrypt from 'bcryptjs';
import { EmailAlreadyRegisteredError } from '../../../domain/errors/index.js';

const makeRegisterUser = ({ userRepo }) => {
  return async ({ email, password, displayName, locale = 'tr' }) => {
    const existing = await userRepo.findByEmail(email);
    if (existing) {
      throw new EmailAlreadyRegisteredError(email);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    return userRepo.create({ email, passwordHash, displayName, locale });
  };
};

export { makeRegisterUser };
