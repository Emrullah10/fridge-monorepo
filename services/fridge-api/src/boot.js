import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { errorHandler, requestLogger } from '@fridge/middlewares';
import { log } from '@fridge/helper';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

import { makeAuthMiddleware } from '../middlewares/auth.middleware.js';
import { buildRouter } from '../routes/index.js';

// origin: true her origin'i yansıtır — credentials: true ile birleşince
// tehlikeli bir kombinasyon. Prod'da CORS_ALLOWED_ORIGINS zorunlu
// (virgülle ayrılmış liste); dev'de mobil/web farklı portlardan geldiği
// için whitelist vermek pratik değil, o yüzden orada fallback korunuyor.
const buildCorsOptions = (config) => {
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (allowedOrigins.length > 0) {
    return { origin: allowedOrigins, credentials: true };
  }

  if (config.nodeEnv === 'production') {
    throw new Error('CORS_ALLOWED_ORIGINS is required in production');
  }

  log.warn('cors_open_origin_dev_only', { message: 'CORS_ALLOWED_ORIGINS not set, reflecting all origins (dev only)' });
  return { origin: true, credentials: true };
};

const boot = (container) => {
  const app = express();

  // Nginx gibi bir reverse proxy arkasında çalışıyor — bu olmadan req.ip
  // proxy'nin IP'si olur ve login rate limiter tüm kullanıcıları tek
  // kovada toplar.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors(buildCorsOptions(container.config)));
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  app.use(requestLogger());

  const authenticate = makeAuthMiddleware({ tokenService: container.tokenService, userRepo: container.repos.userRepo });

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Play Store store listing'in istediği halka açık gizlilik politikası
  // ve hesap silme sayfaları — ayrı hosting gerektirmesin diye API'den
  // servis ediliyor.
  app.get('/privacy', (req, res) => res.sendFile(join(publicDir, 'privacy.html')));
  app.get('/delete-account', (req, res) => res.sendFile(join(publicDir, 'delete-account.html')));

  app.use('/api', buildRouter({ container, authenticate }));

  app.use(errorHandler());

  return app;
};

export { boot };
