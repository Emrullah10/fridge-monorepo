import { log } from '@fridge/helper';

const requestLogger = () => (req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    // req.user, requestLogger'dan SONRA çalışan authenticate middleware'i
    // tarafından set edilir — ama 'finish' olayı tüm route zincirinden
    // sonra tetiklendiği için buraya geldiğimizde zaten doludur. userId
    // olmadan "hangi kullanıcı 404 aldı" sorusu log kazısı + DB sorgusu
    // gerektiriyordu (bkz. .wolf/buglog.json, 2026-09-06 "Household not
    // found" teşhisi).
    log.info('http_request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      userId: req.user?.id ?? null,
    });
  });
  next();
};

export { requestLogger };
