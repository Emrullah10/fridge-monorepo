import bcrypt from 'bcryptjs';
import { InvalidCredentialsError } from '../../../domain/errors/index.js';

const makeLoginUser = ({ userRepo, sessionRepo, tokenService }) => {
  return async ({ email, password }) => {
    const user = await userRepo.findByEmail(email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const accessToken = tokenService.signAccessToken({ userId: user.id });
    const refreshToken = tokenService.signRefreshToken({ userId: user.id });

    await sessionRepo.create({
      userId: user.id,
      refreshTokenHash: tokenService.hashRefreshToken(refreshToken),
      expiresAt: tokenService.refreshTokenExpiryDate(),
    });

    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      accessToken,
      refreshToken,
    };
  };
};

export { makeLoginUser };
