import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { errorHandler, requestLogger } from '@fridge/middlewares';
import { log } from '@fridge/helper';

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

  app.use(cors(buildCorsOptions(container.config)));
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestLogger());

  const authenticate = makeAuthMiddleware({ tokenService: container.tokenService, userRepo: container.repos.userRepo });

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api', buildRouter({ container, authenticate }));

  app.use(errorHandler());

  return app;
};

export { boot };
