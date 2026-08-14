import { UnauthorizedError } from '@fridge/errors';

const makeRefreshSession = ({ sessionRepo, tokenService }) => {
  return async ({ refreshToken }) => {
    let payload;
    try {
      payload = tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const tokenHash = tokenService.hashRefreshToken(refreshToken);
    const session = await sessionRepo.findActiveByTokenHash(tokenHash);
    if (!session || session.userId !== payload.userId) {
      throw new UnauthorizedError('Session not found or revoked');
    }

    await sessionRepo.revoke(session.id);

    const newRefreshToken = tokenService.signRefreshToken({ userId: payload.userId });
    await sessionRepo.create({
      userId: payload.userId,
      refreshTokenHash: tokenService.hashRefreshToken(newRefreshToken),
      expiresAt: tokenService.refreshTokenExpiryDate(),
    });

    return {
      accessToken: tokenService.signAccessToken({ userId: payload.userId }),
      refreshToken: newRefreshToken,
    };
  };
};

export { makeRefreshSession };
