import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ValidationError } from '@fridge/errors';
import { InvalidCredentialsError } from '../../../domain/errors/index.js';

const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 10;
const MAX_ATTEMPTS = 5;

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

const makeResetPassword = ({ userRepo, passwordResetRepo, sessionRepo }) => {
  return async ({ email, code, newPassword }) => {
    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı`);
    }

    const user = await userRepo.findByEmail(email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const token = await passwordResetRepo.findActiveByUserId(user.id);
    if (!token || token.attempts >= MAX_ATTEMPTS) {
      throw new InvalidCredentialsError();
    }

    const providedHash = hashCode(String(code ?? ''));
    if (providedHash !== token.codeHash) {
      await passwordResetRepo.incrementAttempts(token.id);
      throw new InvalidCredentialsError();
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await userRepo.updatePassword(user.id, passwordHash);
    await passwordResetRepo.markConsumed(token.id);

    // Şifre sıfırlandıysa çalınmış/eski oturumlar da düşmeli.
    await sessionRepo.revokeAllForUser(user.id);
  };
};

export { makeResetPassword };
