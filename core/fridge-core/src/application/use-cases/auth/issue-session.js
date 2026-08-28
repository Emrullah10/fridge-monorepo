// login-user.use-case.js ve create-guest-user.use-case.js aynı token/session
// üretim mantığına ihtiyaç duyuyordu — tek yerde tutulur, iki yerde
// kopyalanmaz.
const issueSession = async ({ sessionRepo, tokenService }, user) => {
  const accessToken = tokenService.signAccessToken({ userId: user.id });
  const refreshToken = tokenService.signRefreshToken({ userId: user.id });

  await sessionRepo.create({
    userId: user.id,
    refreshTokenHash: tokenService.hashRefreshToken(refreshToken),
    expiresAt: tokenService.refreshTokenExpiryDate(),
  });

  return { accessToken, refreshToken };
};

export { issueSession };
