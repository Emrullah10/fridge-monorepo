import { normalizeOcrArtifacts } from './text-normalize.js';
import { RESPONSE_SCHEMA, SYSTEM_PROMPT, finalizeItem, extractTotalAmount } from './line-item-finalizer.js';

// Ollama'nın JSON Schema formatı (`type: ['string','null']` union, iç içe
// `properties`) Gemini'nin `responseSchema` alanıyla neredeyse aynı, iki
// fark var: (1) `type` değerleri büyük harf enum'dur ("OBJECT"/"ARRAY"/
// "STRING"/"NUMBER"), (2) null'a izin veren alanlar union yerine ayrı bir
// `nullable: true` bayrağı kullanır. Bu fonksiyon ortak RESPONSE_SCHEMA'yı
// (line-item-finalizer.js) elle iki kez yazmak yerine tek kaynaktan çevirir.
const toGeminiType = (type) => {
  if (Array.isArray(type)) {
    const nonNull = type.find((t) => t !== 'null');
    return { type: toGeminiType(nonNull).type, nullable: type.includes('null') };
  }
  const map = { object: 'OBJECT', array: 'ARRAY', string: 'STRING', number: 'NUMBER', boolean: 'BOOLEAN' };
  return { type: map[type] ?? 'STRING' };
};

const toGeminiSchema = (schema) => {
  const { type, nullable } = toGeminiType(schema.type);
  const result = { type, ...(nullable ? { nullable: true } : {}) };

  if (schema.enum) result.enum = schema.enum.filter((value) => value !== null);
  if (schema.required) result.required = schema.required;
  if (schema.properties) {
    result.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [key, toGeminiSchema(value)]),
    );
  }
  if (schema.items) result.items = toGeminiSchema(schema.items);

  return result;
};

const GEMINI_RESPONSE_SCHEMA = toGeminiSchema(RESPONSE_SCHEMA);

// Kademe 2: ham metin -> yapılandırılmış satır kalemleri. Ollama adaptörüyle
// aynı ReceiptParserPort sözleşmesini uygular (bkz.
// application/ports/receipt-parser-port.js); deterministik post-processing
// (ölçü/marka/isim/kategori) line-item-finalizer.js'de paylaşılıyor.
const makeGeminiTextParser = ({ apiKey, model, fetchFn = fetch }) => {
  return {
    parse: async ({ rawText }) => {
      // Modele göndermeden önce sık OCR kod sayfası kaymalarını düzelt
      // (İ/Ì, Ğ/à karışması) — model daha temiz girdi görsün.
      const cleanedRawText = normalizeOcrArtifacts(rawText);

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
              contents: [{ role: 'user', parts: [{ text: cleanedRawText }] }],
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
