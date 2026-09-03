import { log } from '@fridge/helper';

// Basit bellek-içi rate limiter — Redis gerektirmiyor. Tek instance için
// yeterli; yatay ölçeklenirse (birden fazla process) paylaşımlı bir depoya
// (Redis) geçmek gerekir, ama şu an için bu bilinçli bir basitleştirme.
const requestLog = new Map(); // key -> [timestamp, ...]

// requestLog süresi geçmiş anahtarları hiç temizlemiyordu — uzun süre çalışan
// bir process'te sınırsız büyürdü (her yeni IP/userId kalıcı bir kayıt
// bırakıyordu). Periyodik olarak süresi geçmiş timestamp'i tamamen boş kalan
// anahtarları budar. windowMs'ler saat mertebesinde olduğu için 10 dakikalık
// bir aralık yeterince sık.
const PRUNE_INTERVAL_MS = 10 * 60 * 1000;
let lastPruneAt = Date.now();
const pruneIfDue = (windowMs) => {
  const now = Date.now();
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;
  for (const [key, timestamps] of requestLog) {
    const fresh = timestamps.filter((t) => now - t < windowMs);
    if (fresh.length === 0) requestLog.delete(key);
    else requestLog.set(key, fresh);
  }
};

// limitName: hangi limitin tetiklendiğini loglara düşürür — "Çok fazla istek"
// mesajı önceden hem misafir kaydı hem özellik limitleri hem de misafir
// günlük kotası için AYNI görünüyordu, bu yüzden kullanıcı ne olduğunu
// anlayamıyor bizim de hangisinin gerçekte vurduğunu loglardan ayırt etmemiz
// mümkün değildi.
const rateLimiter = ({ windowMs, maxRequests, keyFn = (req) => req.ip, limitName = 'default' }) => {
  return (req, res, next) => {
    pruneIfDue(windowMs);
    const key = `${limitName}:${keyFn(req)}`;
    const now = Date.now();
    const timestamps = (requestLog.get(key) ?? []).filter((t) => now - t < windowMs);

    if (timestamps.length >= maxRequests) {
      const retryAfterSeconds = Math.ceil((windowMs - (now - timestamps[0])) / 1000);
      log.warn('rate_limited', { limitName, route: req.originalUrl, key, retryAfterSeconds });
      res.set('Retry-After', String(Math.max(retryAfterSeconds, 1)));
      return res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: `Çok hızlı gidiyorsun, ${Math.max(retryAfterSeconds, 1)} saniye sonra tekrar dene.`,
        },
        retryAfterSeconds: Math.max(retryAfterSeconds, 1),
      });
    }

    timestamps.push(now);
    requestLog.set(key, timestamps);
    next();
  };
};

export { rateLimiter };
