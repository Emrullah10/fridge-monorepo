import { normalizeOcrArtifacts } from './text-normalize.js';
import { RESPONSE_SCHEMA, SYSTEM_PROMPT, finalizeItem, extractTotalAmount } from './line-item-finalizer.js';
import { callGroq, extractJson } from '../groq/groq-client.js';

// gemini-text.adapter.js ile AYNI ReceiptParserPort sözleşmesi, AYNI
// SYSTEM_PROMPT/RESPONSE_SCHEMA/finalizeItem post-processing zinciri —
// tek fark sağlayıcı: Groq'un openai/gpt-oss-120b modeli, ücretsiz katmanda
// (2026-08-29 ölçümü, gerçek hesap) 1000 istek/gün — Gemini 2.5 Flash'ın
// ücretsiz 20 istek/gün'ünün 50 katı. Groq'un response_format'ı Gemini'nin
// responseSchema'sı kadar katı değil (sadece json_object, alan/tip garantisi
// yok) — bu yüzden şema kullanıcı prompt'una metin olarak ekleniyor
// (RESPONSE_SCHEMA JSON.stringify edilerek), modelin buna uyması promptun
// gücüne kalıyor. finalizeItem zaten modelin çıktısını normalize ediyor,
// eksik/yanlış tip gelirse orada elenir.
const makeGroqTextParser = ({ apiKey, model = 'openai/gpt-oss-120b', fetchFn = fetch, onUsage }) => {
  return {
    parse: async ({ rawText, merchantHint = null }) => {
      const cleanedRawText = normalizeOcrArtifacts(rawText);
      const userMessage = merchantHint
        ? `MARKET: ${merchantHint}\n${cleanedRawText}`
        : cleanedRawText;
      const userPrompt = `${userMessage}\n\nJSON şemasına uygun cevap ver: ${JSON.stringify(RESPONSE_SCHEMA)}`;

      const body = await callGroq({
        apiKey,
        model,
        feature: 'receipt',
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        temperature: 0.1,
        maxCompletionTokens: 4096,
        timeoutMs: 30_000,
        fetchFn,
        onUsage,
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
        provider: 'groq-text',
        model,
      };
    },
  };
};

export { makeGroqTextParser };
