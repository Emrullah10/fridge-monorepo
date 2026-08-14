import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';

const REFRESH_COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', path: '/api/auth' };

// Web: refresh token httpOnly cookie'de kalır (JS erişemez, XSS'e karşı güvenli).
// Mobil (Flutter'da native cookie jar yok): aynı token body'de de döner,
// istemci Keychain/Keystore'da saklar. X-Client-Type header'ı ayrımı yapar.
const isMobileClient = (req) => req.headers['x-client-type'] === 'mobile';

const buildAuthRouter = ({ container }) => {
  const router = Router();
  const { useCases } = container;

  router.post('/register', asyncHandler(async (req, res) => {
    const { email, password, displayName, locale } = req.body;
    const user = await useCases.registerUser({ email, password, displayName, locale });
    res.status(201).json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
  }));

  router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await useCases.loginUser({ email, password });

    if (isMobileClient(req)) {
      return res.json({ user, accessToken, refreshToken });
    }

    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTS);
    res.json({ user, accessToken });
  }));

  router.post('/refresh', asyncHandler(async (req, res) => {
    const refreshToken = isMobileClient(req) ? req.body?.refreshToken : req.cookies?.refresh_token;
    const { accessToken, refreshToken: newRefreshToken } = await useCases.refreshSession({ refreshToken });

    if (isMobileClient(req)) {
      return res.json({ accessToken, refreshToken: newRefreshToken });
    }

    res.cookie('refresh_token', newRefreshToken, REFRESH_COOKIE_OPTS);
    res.json({ accessToken });
  }));

  router.post('/logout', asyncHandler(async (req, res) => {
    const refreshToken = isMobileClient(req) ? req.body?.refreshToken : req.cookies?.refresh_token;
    if (refreshToken) {
      await useCases.logoutUser({ refreshToken });
    }
    res.clearCookie('refresh_token', REFRESH_COOKIE_OPTS);
    res.status(204).end();
  }));

  return router;
};

export { buildAuthRouter };
