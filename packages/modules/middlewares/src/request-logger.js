import { log } from '@fridge/helper';

const requestLogger = () => (req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    log.info('http_request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  next();
};

export { requestLogger };
