import { Router } from 'express';
import { asyncHandler } from '@fridge/helper';
import { ValidationError } from '@fridge/errors';
import { rateLimiter, requireAuth } from '@fridge/middlewares';

// Brute-force koruması: aynı IP'den 15 dakikada en fazla 10 giriş denemesi.
const loginRateLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 10 });

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/api/auth',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000, // token-service.js REFRESH_TOKEN_TTL ile eşleşir
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// Doğrulama olmadan undefined email/password bcrypt.hash'e gidip 500 atıyordu.
// Şifre uzunluk kuralı da yoktu.
const assertValidRegisterInput = ({ email, password, displayName }) => {
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email)) {
    throw new ValidationError('Geçerli bir e-posta adresi gerekli');
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı`);
  }
  if (typeof displayName !== 'string' || displayName.trim().length === 0) {
    throw new ValidationError('Ad soyad gerekli');
  }
};

const assertValidLoginInput = ({ email, password }) => {
  if (typeof email !== 'string' || email.length === 0) {
    throw new ValidationError('E-posta gerekli');
  }
  if (typeof password !== 'string' || password.length === 0) {
    throw new ValidationError('Şifre gerekli');
  }
};

// Web: refresh token httpOnly cookie'de kalır (JS erişemez, XSS'e karşı güvenli).
// Mobil (Flutter'da native cookie jar yok): aynı token body'de de döner,
// istemci Keychain/Keystore'da saklar. X-Client-Type header'ı ayrımı yapar.
const isMobileClient = (req) => req.headers['x-client-type'] === 'mobile';

const buildAuthRouter = ({ container }) => {
  const router = Router();
  const { useCases, repos } = container;

  router.post('/register', asyncHandler(async (req, res) => {
    const { email, password, displayName, locale } = req.body ?? {};
    assertValidRegisterInput({ email, password, displayName });
    const user = await useCases.registerUser({ email, password, displayName, locale });
    res.status(201).json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
  }));

  router.post('/login', loginRateLimiter, asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    assertValidLoginInput({ email, password });
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
    // Çıkış yapan cihazın push token'ı silinmezse, aynı cihazda başka bir
    // kullanıcı giriş yaptığında (paylaşılan cihaz) eski kullanıcı hâlâ
    // bildirim alabilir — device-token upsert'i user_id'yi devretse de bu
    // gecikme kadar bir sızıntı penceresi kalır. userId'ye scope'lamıyoruz
    // (refresh token süresi dolmuş olabilir, req.user set olmayabilir);
    // token zaten bu isteği yapan cihazın kendi bildirdiği değer.
    if (typeof req.body?.deviceToken === 'string' && req.body.deviceToken.length > 0) {
      await repos.deviceTokenRepo.deleteByTokens([req.body.deviceToken]);
    }
    res.clearCookie('refresh_token', REFRESH_COOKIE_OPTS);
    res.status(204).end();
  }));

  // Uygulama yeniden açıldığında oturum token'dan geri yükleniyor ama
  // kullanıcı bilgisi (ad/e-posta) hiçbir yerde saklanmıyordu — mobil
  // AuthController._restoreSession() sadece token varlığına bakıp user'ı
  // null bırakıyordu. Bu endpoint o boşluğu dolduruyor.
  router.get('/me', requireAuth(), asyncHandler(async (req, res) => {
    const user = await repos.userRepo.findById(req.user.id);
    res.json({ user: { id: user.id, email: user.email, displayName: user.displayName, locale: user.locale } });
  }));

  router.patch('/me', requireAuth(), asyncHandler(async (req, res) => {
    const user = await useCases.updateProfile({
      userId: req.user.id,
      displayName: req.body?.displayName,
      locale: req.body?.locale,
    });
    res.json({ user: { id: user.id, email: user.email, displayName: user.displayName, locale: user.locale } });
  }));

  router.post('/change-password', requireAuth(), asyncHandler(async (req, res) => {
    await useCases.changePassword({
      userId: req.user.id,
      currentPassword: req.body?.currentPassword,
      newPassword: req.body?.newPassword,
    });
    res.status(204).end();
  }));

  // Play Store hesap silme politikası: kullanıcı kimliğini şifreyle yeniden
  // doğrular (çalıntı/unutulmuş oturumla yanlışlıkla silmeyi önler).
  router.delete('/me', requireAuth(), asyncHandler(async (req, res) => {
    const { password } = req.body ?? {};
    if (typeof password !== 'string' || password.length === 0) {
      throw new ValidationError('Şifre gerekli');
    }
    await useCases.deleteAccount({ userId: req.user.id, password });
    res.clearCookie('refresh_token', REFRESH_COOKIE_OPTS);
    res.status(204).end();
  }));

  return router;
};

export { buildAuthRouter };
