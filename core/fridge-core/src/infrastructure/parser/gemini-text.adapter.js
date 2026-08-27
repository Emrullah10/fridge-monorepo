import { normalizeOcrArtifacts } from './text-normalize.js';
import { RESPONSE_SCHEMA, SYSTEM_PROMPT, finalizeItem, extractTotalAmount } from './line-item-finalizer.js';
import { toGeminiSchema } from '../gemini/gemini-schema.js';

const GEMINI_RESPONSE_SCHEMA = toGeminiSchema(RESPONSE_SCHEMA);

// Kademe 2: ham metin -> yapılandırılmış satır kalemleri. Ollama adaptörüyle
// aynı ReceiptParserPort sözleşmesini uygular (bkz.
// application/ports/receipt-parser-port.js); deterministik post-processing
// (ölçü/marka/isim/kategori) line-item-finalizer.js'de paylaşılıyor.
const makeGeminiTextParser = ({ apiKey, model, fetchFn = fetch }) => {
  return {
    parse: async ({ rawText, merchantHint = null }) => {
      // Modele göndermeden önce sık OCR kod sayfası kaymalarını düzelt
      // (İ/Ì, Ğ/à karışması) — model daha temiz girdi görsün.
      const cleanedRawText = normalizeOcrArtifacts(rawText);
      // merchantHint ham metinden deterministik çıkarıldığı için AI
      // çağrısından önce zaten biliniyor — modele context olarak veriyoruz,
      // SYSTEM_PROMPT kural 8 bunu zincire özgü kısaltmaları açmak için kullanır.
      const userMessage = merchantHint
        ? `MARKET: ${merchantHint}\n${cleanedRawText}`
        : cleanedRawText;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      let response;
      try {
        response = await fetchFn(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: [{ role: 'user', parts: [{ text: userMessage }] }],
              generationConfig: {
                // Fiş ayrıştırma kural takibi istiyor, yaratıcılık değil —
                // düşük temperature modelin miktar/birim uydurmasını azaltır.
                temperature: 0.1,
                responseMimeType: 'application/json',
                responseSchema: GEMINI_RESPONSE_SCHEMA,
              },
            }),
          },
        );
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(`Gemini request failed: ${response.status} ${response.statusText}`);
      }

      const body = await response.json();
      const parsed = JSON.parse(body.candidates[0].content.parts[0].text);

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
