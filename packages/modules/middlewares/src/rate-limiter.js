// Basit bellek-içi rate limiter — Redis gerektirmiyor. Tek instance için
// yeterli; yatay ölçeklenirse (birden fazla process) paylaşımlı bir depoya
// (Redis) geçmek gerekir, ama şu an için bu bilinçli bir basitleştirme.
const requestLog = new Map(); // key -> [timestamp, ...]

const rateLimiter = ({ windowMs, maxRequests, keyFn = (req) => req.ip }) => {
  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const timestamps = (requestLog.get(key) ?? []).filter((t) => now - t < windowMs);

    if (timestamps.length >= maxRequests) {
      return res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Çok fazla istek gönderildi, biraz bekleyin.' },
      });
    }

    timestamps.push(now);
    requestLog.set(key, timestamps);
    next();
  };
};

export { rateLimiter };
