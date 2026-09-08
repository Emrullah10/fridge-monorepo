import {
  SHOPPING_RESPONSE_SCHEMA,
  RHYTHM_SYSTEM_PROMPT,
  buildRhythmUserPrompt,
  TEXT_SYSTEM_PROMPT,
  buildTextUserPrompt,
} from './shopping-prompt.js';
import { callGroq, extractJson } from '../groq/groq-client.js';

// shopping-suggester-port.js sözleşmesini uygular.
// Groq'un OpenAI uyumlu /chat/completions ucu üzerinden alışveriş önerileri üretir.
const callAndParse = async ({ apiKey, model, fetchFn, onUsage, systemPrompt, userPrompt, timeoutMs, context }) => {
  const promptWithSchema = `${userPrompt}\n\nJSON şemasına uygun cevap ver: ${JSON.stringify(SHOPPING_RESPONSE_SCHEMA)}`;

  const body = await callGroq({
    apiKey,
    model,
    feature: 'shopping',
    systemPrompt,
    userPrompt: promptWithSchema,
    temperature: 0.3,
    maxCompletionTokens: 2048,
    timeoutMs,
    fetchFn,
    onUsage,
    context,
  });

  const parsed = extractJson(body);
  return parsed.suggestions ?? [];
};

const makeGroqShoppingSuggester = ({ apiKey, model = 'openai/gpt-oss-120b', fetchFn = fetch, onUsage }) => {
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

export { makeGroqShoppingSuggester };
