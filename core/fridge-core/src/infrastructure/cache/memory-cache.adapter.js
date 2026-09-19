// REDIS_URL yoksa (dev, ya da Redis container'ı ayakta değilse) container.js
// bunu kurar — FCM'in no-op notifier'ıyla AYNI ilke (bkz. notification/
// noop.adapter.js): Redis'in yokluğu boot'u asla patlatmamalı, tek process'te
// davranış Redis'liyle neredeyse aynıdır, yalnızca restart'ta cache boşalır.
//
// Bu dosya AYNI ZAMANDA test double'dır (bkz. plan §Test stratejisi) — ayrı
// bir fake yazmak yerine üretimdeki fallback adaptörü test ediyoruz, böylece
// hem test double hem gerçek fallback yolu aynı kodla doğrulanır.
//
// rate-limiter.js'in eski in-memory Map deseniyle AYNI budama ilkesi:
// süresi geçmiş anahtarlar periyodik silinir, aksi halde uzun süren bir
// process'te sınırsız büyür.
const PRUNE_INTERVAL_MS = 10 * 60 * 1000;

const makeMemoryCache = () => {
  const store = new Map(); // key -> { value, expiresAt }
  let lastPruneAt = Date.now();

  const pruneIfDue = () => {
    const now = Date.now();
    if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
    lastPruneAt = now;
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) store.delete(key);
    }
  };

  const isExpired = (entry) => !entry || entry.expiresAt <= Date.now();

  const get = async (key) => {
    pruneIfDue();
    const entry = store.get(key);
    if (isExpired(entry)) {
      if (entry) store.delete(key);
      return null;
    }
    return entry.value;
  };

  const set = async (key, value, { ttlSeconds }) => {
    pruneIfDue();
    store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  };

  const del = async (key) => {
    store.delete(key);
  };

  // Redis MULTI(INCR+EXPIRE NX) ile AYNI sözleşme: TTL yalnızca anahtar
  // ilk kez oluşturulduğunda set edilir (sabit pencere davranışı korunur).
  const incrWithExpire = async (key, ttlSeconds) => {
    pruneIfDue();
    const entry = store.get(key);
    if (isExpired(entry)) {
      store.set(key, { value: 1, expiresAt: Date.now() + ttlSeconds * 1000 });
      return { count: 1 };
    }
    entry.value += 1;
    return { count: entry.value };
  };

  // In-memory her zaman "sağlıklı" — asla düşmez, bu yüzden rate limiter
  // fail-degraded yoluna hiç girmez (zaten kendisi o yoldur).
  const isHealthy = () => true;
  const close = async () => {};

  return { get, set, del, incrWithExpire, isHealthy, close };
};

export { makeMemoryCache };
