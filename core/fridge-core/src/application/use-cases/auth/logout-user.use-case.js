const makeLogoutUser = ({ sessionRepo, tokenService }) => {
  return async ({ refreshToken }) => {
    const tokenHash = tokenService.hashRefreshToken(refreshToken);
    const session = await sessionRepo.findActiveByTokenHash(tokenHash);
    if (session) {
      await sessionRepo.revoke(session.id);
    }
  };
};

export { makeLogoutUser };
