const makeAuthMiddleware = ({ tokenService, userRepo }) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.access_token;

      if (!token) {
        req.user = null;
        return next();
      }

      const payload = tokenService.verifyAccessToken(token);
      const user = await userRepo.findById(payload.userId);
      req.user = user ? { id: user.id, email: user.email } : null;
      return next();
    } catch {
      req.user = null;
      return next();
    }
  };
};

export { makeAuthMiddleware };
