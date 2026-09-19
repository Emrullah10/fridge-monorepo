/**
 * Kasıtlı olarak DAR tutulan port: get/set/del/incrWithExpire/isHealthy/close.
 * Redis'in 200 komutunu buraya sızdırmak ileride sağlayıcı değiştirmeyi
 * (veya tamamen kaldırmayı) imkansız kılar — bkz. plan §Redis Faz 1.
 *
 * Bu port'un hiçbir implementasyonu (redis-cache.adapter.js dahil) ASLA
 * hata fırlatmaz — Redis'in yokluğu/kesintisi hiçbir isteği asla 500'e
 * düşürmemeli (proje geneli fail-soft ilkesi, bkz. fcm.adapter/noop.adapter,
 * cached-play-version.js). get() hata durumunda null (=cache miss) döner,
 * set()/del() sessizce yutar, incrWithExpire() null döner (çağıran taraf
 * "Redis şu an bilinmiyor" olarak yorumlar).
 *
 * @typedef {Object} CachePort
 * @property {(key: string) => Promise<any|null>} get
 * @property {(key: string, value: any, opts: { ttlSeconds: number }) => Promise<void>} set
 * @property {(key: string) => Promise<void>} del
 * @property {(key: string, ttlSeconds: number) => Promise<{ count: number }|null>} incrWithExpire
 * @property {() => boolean} isHealthy
 * @property {() => Promise<void>} close
 */

export {};
