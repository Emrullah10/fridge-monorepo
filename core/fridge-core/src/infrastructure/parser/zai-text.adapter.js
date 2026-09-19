import { normalizeOcrArtifacts } from './text-normalize.js';
import { RESPONSE_SCHEMA, SYSTEM_PROMPT, finalizeItem, extractTotalAmount } from './line-item-finalizer.js';
import { callZaiCached, extractJson, DEFAULT_MODEL } from '../ai/zai.js';

// gemini-text.adapter.js ile AYNI ReceiptParserPort sözleşmesi, AYNI
// SYSTEM_PROMPT/RESPONSE_SCHEMA/finalizeItem post-processing zinciri —
// sağlayıcı Z.ai'nin ücretsiz glm-4.7-flash modeli, thinking kapalı
// (bkz. ai/zai.js). Z.ai'nin response_format'ı Gemini'nin responseSchema'sı
// kadar katı değil (sadece json_object, alan/tip garantisi yok) — bu yüzden
// şema kullanıcı prompt'una metin olarak ekleniyor (RESPONSE_SCHEMA
// JSON.stringify edilerek), modelin buna uyması promptun gücüne kalıyor.
// finalizeItem zaten modelin çıktısını normalize ediyor, eksik/yanlış tip
// gelirse orada elenir.
//
// cache/cacheEnabled: Faz 2 AI cache'i (bkz. plan §Redis) — fiş parser
// deterministik (temperature 0.1), kullanıcıya özel bağlam TAŞIMIYOR (sadece
// rawText+merchantHint), bu yüzden AI özelliklerinin içinde cache'lenmeye en
// uygun olanı. cache verilmezse veya cacheEnabled:false ise callZaiCached
// aynen callZai gibi davranır (bkz. cached-ai-call.js).
const makeZaiTextParser = ({ apiKey, model = DEFAULT_MODEL, fetchFn = fetch, onUsage, cache, cacheEnabled = false, cacheTtlSeconds }) => {
  return {
    parse: async ({ rawText, merchantHint = null, householdId = null }) => {
      const cleanedRawText = normalizeOcrArtifacts(rawText);
      const userMessage = merchantHint
        ? `MARKET: ${merchantHint}\n${cleanedRawText}`
        : cleanedRawText;
      const userPrompt = `${userMessage}\n\nJSON şemasına uygun cevap ver: ${JSON.stringify(RESPONSE_SCHEMA)}`;

      const body = await callZaiCached({
        apiKey,
        model,
        feature: 'receipt',
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        temperature: 0.1,
        maxTokens: 4096,
        timeoutMs: 30_000,
        fetchFn,
        onUsage,
        cache,
        cacheable: cacheEnabled,
        householdId,
        ttlSeconds: cacheTtlSeconds,
      });

      const parsed = extractJson(body);

      return {
        lineItems: (parsed.lineItems ?? []).map((item, index) => ({
          lineNo: index + 1,
          ...finalizeItem(item),
        })),
        merchantName: parsed.merchantName ?? null,
        purchasedAt: parsed.purchasedAt ?? null,
        totalAmount: parsed.totalAmount ?? extractTotalAmount(cleanedRawText),
        provider: 'zai-text',
        model,
      };
    },
  };
};

export { makeZaiTextParser };
