import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { errorHandler, requestLogger } from '@fridge/middlewares';

import { makeAuthMiddleware } from '../middlewares/auth.middleware.js';
import { buildRouter } from '../routes/index.js';

const boot = (container) => {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
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
