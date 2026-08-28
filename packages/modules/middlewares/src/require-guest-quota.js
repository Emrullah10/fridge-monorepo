import { rateLimiter } from './rate-limiter.js';

// Misafir hesap açmak bedava (email/şifre doğrulaması yok) — Gemini
// harcayan uçlar (fiş tarama, tarif üretimi, chef sohbeti) misafirde de
// çalışır ama ayrıca kotalanır, aksi halde API anahtarı sınırsız bir
// harcama kapısına dönüşür. Kayıtlı kullanıcılar bu limite TAKILMAZ —
// req.user.isGuest false ise doğrudan next() çağrılır.
//
// keyFn userId'ye bağlı (rate-limiter.js'nin varsayılan req.ip'sinden
// farklı) — aynı IP'den birden fazla misafir cihazı (ör. paylaşımlı wifi)
// birbirini bloklamasın.
const requireGuestQuota = ({ windowMs, maxRequests }) => {
  const limiter = rateLimiter({ windowMs, maxRequests, keyFn: (req) => req.user?.id });
  return (req, res, next) => {
    if (!req.user?.isGuest) return next();
    return limiter(req, res, next);
  };
};

export { requireGuestQuota };
