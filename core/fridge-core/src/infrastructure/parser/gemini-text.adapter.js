import { normalizeOcrArtifacts } from './text-normalize.js';
import { RESPONSE_SCHEMA, SYSTEM_PROMPT, finalizeItem, extractTotalAmount } from './line-item-finalizer.js';
import { toGeminiSchema } from '../gemini/gemini-schema.js';
import { callGemini, extractJson } from '../gemini/gemini-client.js';

const GEMINI_RESPONSE_SCHEMA = toGeminiSchema(RESPONSE_SCHEMA);

// Kademe 2: ham metin -> yapılandırılmış satır kalemleri. Ollama adaptörüyle
// aynı ReceiptParserPort sözleşmesini uygular (bkz.
// application/ports/receipt-parser-port.js); deterministik post-processing
// (ölçü/marka/isim/kategori) line-item-finalizer.js'de paylaşılıyor.
// HTTP/hata/retry/kullanım ölçümü artık gemini-client.js'de paylaşılıyor.
const makeGeminiTextParser = ({ apiKey, model, fetchFn = fetch, onUsage }) => {
  return {
    parse: async ({ rawText, merchantHint = null, context }) => {
      // Modele göndermeden önce sık OCR kod sayfası kaymalarını düzelt
      // (İ/Ì, Ğ/à karışması) — model daha temiz girdi görsün.
      const cleanedRawText = normalizeOcrArtifacts(rawText);
      // merchantHint ham metinden deterministik çıkarıldığı için AI
      // çağrısından önce zaten biliniyor — modele context olarak veriyoruz,
      // SYSTEM_PROMPT kural 8 bunu zincire özgü kısaltmaları açmak için kullanır.
      const userMessage = merchantHint
        ? `MARKET: ${merchantHint}\n${cleanedRawText}`
        : cleanedRawText;

      const body = await callGemini({
        apiKey,
        model,
        feature: 'receipt',
        systemPrompt: SYSTEM_PROMPT,
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          // Fiş ayrıştırma kural takibi istiyor, yaratıcılık değil —
          // düşük temperature modelin miktar/birim uydurmasını azaltır.
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_RESPONSE_SCHEMA,
        },
        timeoutMs: 30_000,
        fetchFn,
        onUsage,
        context,
      });

      const parsed = extractJson(body);

      return {
        lineItems: parsed.lineItems.map((item, index) => ({
          lineNo: index + 1,
          ...finalizeItem(item),
        })),
        merchantName: parsed.merchantName ?? null,
        purchasedAt: parsed.purchasedAt ?? null,
        totalAmount: parsed.totalAmount ?? extractTotalAmount(cleanedRawText),
        provider: 'gemini-text',
        model,
      };
    },
  };
};

export { makeGeminiTextParser, GEMINI_RESPONSE_SCHEMA, toGeminiSchema };
