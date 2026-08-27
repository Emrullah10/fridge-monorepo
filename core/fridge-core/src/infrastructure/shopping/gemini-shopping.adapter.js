import { toGeminiSchema } from '../gemini/gemini-schema.js';
import {
  SHOPPING_RESPONSE_SCHEMA,
  RHYTHM_SYSTEM_PROMPT,
  buildRhythmUserPrompt,
  TEXT_SYSTEM_PROMPT,
  buildTextUserPrompt,
} from './shopping-prompt.js';

const GEMINI_SHOPPING_SCHEMA = toGeminiSchema(SHOPPING_RESPONSE_SCHEMA);

// shopping-suggester-port.js sözleşmesini uygular. gemini-recipe.adapter.js
// ile aynı REST çağrı şekli — temperature düşük (veriden çıkarım, yaratıcılık
// değil), timeout kısa (çıktı küçük, en fazla 8-10 öneri).
const callGemini = async ({ apiKey, model, fetchFn, systemPrompt, userPrompt, timeoutMs }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetchFn(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
            responseSchema: GEMINI_SHOPPING_SCHEMA,
          },
        }),
      },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Gemini shopping request failed: ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  const parsed = JSON.parse(body.candidates[0].content.parts[0].text);
  return parsed.suggestions ?? [];
};

const makeGeminiShoppingSuggester = ({ apiKey, model, fetchFn = fetch }) => {
  return {
    suggest: async ({ profile }) => {
      const suggestions = await callGemini({
        apiKey,
        model,
        fetchFn,
        systemPrompt: RHYTHM_SYSTEM_PROMPT,
        userPrompt: buildRhythmUserPrompt({ profile }),
        timeoutMs: 20_000,
      });
      return { suggestions };
    },

    fromText: async ({ text, inventorySummary }) => {
      const suggestions = await callGemini({
        apiKey,
        model,
        fetchFn,
        systemPrompt: TEXT_SYSTEM_PROMPT,
        userPrompt: buildTextUserPrompt({ text, inventorySummary }),
        timeoutMs: 20_000,
      });
      return { suggestions };
    },
  };
};

export { makeGeminiShoppingSuggester, GEMINI_SHOPPING_SCHEMA };
