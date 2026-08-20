import bcrypt from 'bcryptjs';
import { ValidationError } from '@fridge/errors';
import { InvalidCredentialsError } from '../../../domain/errors/index.js';

const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 10;

const makeChangePassword = ({ userRepo }) => {
  return async ({ userId, currentPassword, newPassword }) => {
    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı`);
    }

    const user = await userRepo.findById(userId);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const matches = await bcrypt.compare(currentPassword ?? '', user.passwordHash);
    if (!matches) {
      throw new InvalidCredentialsError();
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await userRepo.updatePassword(userId, passwordHash);
  };
};

export { makeChangePassword };
