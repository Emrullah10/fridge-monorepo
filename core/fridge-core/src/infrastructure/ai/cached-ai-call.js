import { createHash } from 'node:crypto';
import { callAiModel } from './ai-client.js';

// callAiModel'i saran ince bir cache katmanı. ai-client.js sağlayıcıdan
// BAĞIMSIZ kalmalı (bkz. o dosyanın başındaki yorum) — cache mantığı
// KASITLI OLARAK oraya gömülmedi, burası ayrı bir kademe. Sadece
// cacheable:true ile çağrılan adaptörler (bkz. zai-text.adapter.js) bunu
// kullanır; recipe/chef HİÇ değişmedi, doğrudan callZai/callAiModel'e gider.
//
// Kapsam KASITLI OLARAK dar: yalnızca deterministik (düşük temperature),
// kullanıcıya özel bağlam TAŞIMAYAN prompt'lar (bkz. plan §Redis Faz 2).
// Tarif (temperature 0.7, çeşitlilik bilinçli isteniyor) ve chef (kişiye
// özel sohbet) BURAYA HİÇ SOKULMAMALI — cache'lemek "her seferinde aynı 3
// tarif" gibi bir ÜRÜN REGRESYONU olurdu.
//
// Cache key = sha256(model + systemPrompt + userPrompt + temperature +
// householdId). householdId DAHİL edilmesi bilinçli bir tercih: alias
// tablosu (product-alias.repository.js) zaten household bazlı çalışıyor,
// mimari tutarlılık için cache de öyle olsun — bu aynı zamanda "aynı fişi
// iki kullanıcı çekerse veri paylaşılır mı" sorusunu TAMAMEN ortadan
// kaldırır (her household kendi cache'ini kullanır).
const buildCacheKey = ({ feature, model, systemPrompt, userPrompt, messages, temperature, householdId }) => {
  const payload = JSON.stringify({ model, systemPrompt, userPrompt, messages, temperature, householdId });
  const hash = createHash('sha256').update(payload).digest('hex').slice(0, 32);
  return `ai:${feature}:${hash}`;
};

// Aynı anda gelen AYNI prompt için ikinci bir AI çağrısı yapılmasını
// önler — ilkinin promise'ini paylaşır. KASITLI OLARAK Redis DEĞİL
// process-içi bir Map: dağıtık kilit (SET NX + poll) burada kazandığından
// fazlasını götürür (kilit sahibi ölürse bekleyenler takılır, TTL ayrı bir
// baş ağrısı). Tek process'te bu Map zaten %100 etkili; çok instance'a
// geçildiğinde en kötü ihtimalle instance sayısı kadar çağrı olur —
// kabul edilebilir (bkz. plan §NE YAPILMAMALI, dağıtık kilit).
const inFlight = new Map();

const callAiModelCached = async ({ cache, cacheable = false, householdId, ttlSeconds, ...params }) => {
  if (!cacheable || !cache) return callAiModel(params);

  const key = buildCacheKey({ ...params, householdId });

  // Redis düşükse cache.get null döner (fail-soft, bkz. redis-cache.
  // adapter.js) — akış sorunsuz devam eder, sadece cache hit'i kaçırılır.
  const hit = await cache.get(key);
  if (hit) {
    // Maliyet ölçümü (ai_usage_log) BOZULMAMALI: total_tokens=0 ile
    // raporlar (ai-usage-report.js) cache hit'i PARA harcanmış gibi
    // saymaz; errorCode='CACHE_HIT' ile hit oranı tek GROUP BY ile
    // ölçülebilir (bkz. plan §Redis Faz 2 — "ölçemediğin şeyi haklı
    // çıkaramazsın").
    params.onUsage?.({
      ...params.context,
      feature: params.feature,
      model: params.model,
      ok: true,
      httpStatus: null,
      errorCode: 'CACHE_HIT',
      latencyMs: 0,
      retryCount: 0,
      promptTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
    return hit;
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = callAiModel(params)
    .then(async (body) => {
      // Sadece BAŞARILI ve extractJson'dan geçebilecek yanıtlar
      // cache'lenir — bozuk bir cevabı TTL boyunca servis etmek felaket
      // olurdu. callAiModel zaten hata durumunda reject ediyor, bu .then
      // sadece başarı yolunda çalışır.
      await cache.set(key, body, { ttlSeconds });
      return body;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, promise);
  return promise;
};

export { callAiModelCached, buildCacheKey };
