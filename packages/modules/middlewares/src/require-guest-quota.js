// Misafir hesap açmak bedava (email/şifre doğrulaması yok) — Gemini
// harcayan uçlar (fiş tarama, tarif üretimi, chef sohbeti) misafirde de
// çalışır ama ayrıca kotalanır, aksi halde API anahtarı sınırsız bir
// harcama kapısına dönüşür. Kayıtlı kullanıcılar bu limite TAKILMAZ —
// req.user.isGuest false ise doğrudan next() çağrılır.
//
// Anahtar userId'ye bağlı (rate-limiter.js'nin varsayılan req.ip'sinden
// farklı) — aynı IP'den birden fazla misafir cihazı (ör. paylaşımlı wifi)
// birbirini bloklamasın. limitName anahtara katılır (rate-limiter.js'deki
// aynı bug fix'i) — aksi halde receipt/recipe/chef kotaları aynı userId
// anahtarını paylaşıp birbirinin sayacını tüketiyordu (bkz. buglog).
//
// Kendi mesajını/kodunu döner (rate-limiter.js'nin genel "Çok hızlı
// gidiyorsun" mesajını KULLANMAZ) — bu bir hız sınırı değil, günlük bir
// kota; kullanıcı "birazdan tekrar dene" ile "bugünkü hakkın bitti, hesap
// aç" arasındaki farkı görmeli.
const requestLog = new Map(); // key -> [timestamp, ...]

const requireGuestQuota = ({ windowMs, maxRequests, limitName = 'default' }) => {
  return (req, res, next) => {
    if (!req.user?.isGuest) return next();

    const key = `${limitName}:${req.user.id}`;
    const now = Date.now();
    const timestamps = (requestLog.get(key) ?? []).filter((t) => now - t < windowMs);

    if (timestamps.length >= maxRequests) {
      return res.status(429).json({
        error: {
          code: 'GUEST_QUOTA_EXCEEDED',
          message: 'Misafir olarak bugünkü hakkını kullandın. Ücretsiz hesap açarsan sınırsız devam edebilirsin.',
        },
      });
    }

    timestamps.push(now);
    requestLog.set(key, timestamps);
    next();
  };
};

export { requireGuestQuota };
