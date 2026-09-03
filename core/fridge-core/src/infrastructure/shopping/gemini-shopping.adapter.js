import { toGeminiSchema } from '../gemini/gemini-schema.js';
import {
  SHOPPING_RESPONSE_SCHEMA,
  RHYTHM_SYSTEM_PROMPT,
  buildRhythmUserPrompt,
  TEXT_SYSTEM_PROMPT,
  buildTextUserPrompt,
} from './shopping-prompt.js';
import { callGemini, extractJson } from '../gemini/gemini-client.js';

const GEMINI_SHOPPING_SCHEMA = toGeminiSchema(SHOPPING_RESPONSE_SCHEMA);

// shopping-suggester-port.js sözleşmesini uygular. gemini-recipe.adapter.js
// ile aynı REST çağrı şekli — temperature düşük (veriden çıkarım, yaratıcılık
// değil), timeout kısa (çıktı küçük, en fazla 8-10 öneri).
// HTTP/hata/retry/kullanım ölçümü artık gemini-client.js'de paylaşılıyor.
const callAndParse = async ({ apiKey, model, fetchFn, onUsage, systemPrompt, userPrompt, timeoutMs, context }) => {
  const body = await callGemini({
    apiKey,
    model,
    feature: 'shopping',
    systemPrompt,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_SHOPPING_SCHEMA,
    },
    timeoutMs,
    fetchFn,
    onUsage,
    context,
  });

  const parsed = extractJson(body);
  return parsed.suggestions ?? [];
};

const makeGeminiShoppingSuggester = ({ apiKey, model, fetchFn = fetch, onUsage }) => {
  return {
    suggest: async ({ profile, context }) => {
      const suggestions = await callAndParse({
        apiKey,
        model,
        fetchFn,
        onUsage,
        systemPrompt: RHYTHM_SYSTEM_PROMPT,
        userPrompt: buildRhythmUserPrompt({ profile }),
        timeoutMs: 20_000,
        context,
      });
      return { suggestions };
    },

    fromText: async ({ text, inventorySummary, context }) => {
      const suggestions = await callAndParse({
        apiKey,
        model,
        fetchFn,
        onUsage,
        systemPrompt: TEXT_SYSTEM_PROMPT,
        userPrompt: buildTextUserPrompt({ text, inventorySummary }),
        timeoutMs: 20_000,
        context,
      });
      return { suggestions };
    },
  };
};

export { makeGeminiShoppingSuggester, GEMINI_SHOPPING_SCHEMA };
