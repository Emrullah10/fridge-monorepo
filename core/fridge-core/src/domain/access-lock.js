// Düşüş (downgrade) sonrası kilit/blur kararları — TEK doğruluk kaynağı.
// Saf fonksiyonlar: DB/HTTP'ye dokunmaz (hexagonal kısıt, entitlements.js
// ile aynı ilke). "En eski açık kalır" kuralı üçünde de geçerli — silme YOK,
// sadece erişim kapanır (Play politikası + iade riski, bkz. plan §Faz C).

// memberships: [{ householdId, joinedAt }] — kullanıcının üye olduğu TÜM
// alanlar, joinedAt ASC sıralı OLMAK ZORUNDA DEĞİL (burada sıralanır).
// household.count limiti ÜYELİKLERİ sayıyor (household.routes.js:19), bu
// yüzden kilit sıralaması da household.created_at DEĞİL joined_at'e göre
// yapılır — limitin kendisiyle tutarlı kalması için.
// limit === null → sınırsız, hiçbiri kilitli değil.
const resolveLockedHouseholdIds = ({ memberships, limit }) => {
  if (limit === null || limit === undefined) return new Set();
  const sorted = [...memberships].sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
  return new Set(sorted.slice(limit).map((m) => m.householdId));
};

// locations: [{ id, createdAt }] — TEK bir alanın bölümleri. Bölüm limiti
// alan sahibinin planından gelir (location.perHousehold), alan içinde
// created_at ASC sıralanır (üyelik kavramı yok, doğrudan oluşturma sırası).
const resolveLockedLocationIds = ({ locations, limit }) => {
  if (limit === null || limit === undefined) return new Set();
  const sorted = [...locations].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return new Set(sorted.slice(limit).map((l) => l.id));
};

// windowDays === null → sınırsız, pencere kırpılmaz. requestedFrom verilmemiş
// veya izin verilen pencereden daha eskiyse, izin verilen en eski tarihe
// kırpılır. truncated: mobil bunu görüp "daha eski veriler premium'da"
// şeridini gösterir.
const resolveInsightsWindow = ({ windowDays, requestedFrom, now = new Date() }) => {
  if (windowDays === null || windowDays === undefined) {
    return { from: requestedFrom ?? null, truncated: false };
  }
  const earliestAllowed = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const requested = requestedFrom ? new Date(requestedFrom) : null;
  if (!requested || requested.getTime() < earliestAllowed.getTime()) {
    return { from: earliestAllowed.toISOString(), truncated: Boolean(requested) };
  }
  return { from: requestedFrom, truncated: false };
};

export { resolveLockedHouseholdIds, resolveLockedLocationIds, resolveInsightsWindow };
