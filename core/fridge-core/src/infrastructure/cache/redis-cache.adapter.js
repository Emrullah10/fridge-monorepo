import Redis from 'ioredis';
import { log } from '@fridge/helper';

// Redis'in yokluğu/kesintisi ASLA bir isteği 500'e düşürmemeli — fcm.
// adapter/noop.adapter.js ve cached-play-version.js ile AYNI ilke (bkz.
// plan §Redis Faz 1). Her metod kendi try/catch'ini yönetir; get() hata
// halinde null (=cache miss) döner, çağıran taraf zaten DB'ye gitmeyi
// biliyor. set()/del() hata halinde sessizce yutar.
//
// `healthy` bayrağı bir DEVRE KESİCİ: Redis düştüğünde her istek connect
// timeout kadar beklemez (varsayılan 2sn), `if (!healthy) return null` ile
// ANINDA geçer — fail-soft'un "yavaş değil, hızlı başarısız ol" kısmı.
//
// enableOfflineQueue:false + maxRetriesPerRequest:1: Redis'e ulaşılamazken
// komutların SESSİZCE kuyruğa girip sonra (uzun bir süre sonra) patlamasını
// engeller — ioredis'i seçmemizin belirleyici sebebi bu (bkz. plan).
//
// RedisCtor enjekte edilebilir: adaptörün kendi testinde gerçek bir Redis
// bağlantısı kurmadan (fetchFn enjeksiyon deseniyle AYNI ilke, bkz.
// zai-text.adapter.test.js) sahte bir client geçirilebilir.
const makeRedisCache = ({ url, prefix = 'fridge:', connectTimeoutMs = 2000, RedisCtor = Redis }) => {
  const client = new RedisCtor(url, {
    keyPrefix: prefix,          // her key otomatik prefix alır — unutma riski sıfır
    lazyConnect: false,
    enableOfflineQueue: false,  // Redis yoksa komut KUYRUĞA GİRMESİN, hemen patlasın
    maxRetriesPerRequest: 1,    // tek deneme; ikinci deneme kullanıcıyı bekletir
    connectTimeout: connectTimeoutMs,
    retryStrategy: (times) => Math.min(times * 200, 5000), // arka planda yeniden bağlan
  });

  let healthy = false;
  client.on('ready', () => { healthy = true; log.info('redis_ready'); });
  client.on('error', (error) => {
    // Sürekli tekrar eden hatayı log'a boğmamak için sadece durum değişiminde yaz.
    if (healthy) log.warn('redis_error', { message: error.message });
    healthy = false;
  });
  client.on('end', () => { healthy = false; });

  const get = async (key) => {
    if (!healthy) return null; // devre kesici: Redis yokken deneme yapma
    try {
      const raw = await client.get(key);
      return raw === null ? null : JSON.parse(raw);
    } catch (error) {
      log.warn('redis_get_failed', { key, message: error.message });
      return null; // hata = cache miss, çağıran DB'ye gider
    }
  };

  const set = async (key, value, { ttlSeconds }) => {
    if (!healthy) return;
    try {
      await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      log.warn('redis_set_failed', { key, message: error.message });
    }
  };

  const del = async (key) => {
    if (!healthy) return;
    try {
      await client.del(key);
    } catch (error) {
      log.warn('redis_del_failed', { key, message: error.message });
    }
  };

  // INCR + EXPIRE tek MULTI'de atomik olmalı — iki ayrı komut arasında
  // process ölürse TTL'siz bir key kalır ve o kullanıcı sonsuza dek
  // limitli kalır. EXPIRE ... NX: TTL yalnızca anahtar YOKTU'ysa set edilir
  // (sabit pencere davranışı — pencere ortasında tekrar EXPIRE çağrılıp
  // pencerenin sürekli ötelenmesi engellenir).
  const incrWithExpire = async (key, ttlSeconds) => {
    if (!healthy) return null; // null = "bilmiyorum", çağıran karar verir
    try {
      const results = await client.multi().incr(key).expire(key, ttlSeconds, 'NX').exec();
      const [incrErr, count] = results[0];
      if (incrErr) throw incrErr;
      return { count };
    } catch (error) {
      log.warn('redis_incr_failed', { key, message: error.message });
      return null;
    }
  };

  const isHealthy = () => healthy;
  // Bağlantı zaten kopmuşken (enableOfflineQueue:false + stream yazılamaz
  // durumda) client.quit() bir komut olduğu için AYNI offline-queue hatasını
  // fırlatır — shutdown akışında (main.js) bu, temiz kapanmayı engellerdi.
  // disconnect() bir komut DEĞİL, bağlantı zaten kapalıysa no-op'tur.
  const close = async () => {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  };

  return { get, set, del, incrWithExpire, isHealthy, close };
};

export { makeRedisCache };
