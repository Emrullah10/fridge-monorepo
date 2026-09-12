import {
  SHOPPING_RESPONSE_SCHEMA,
  RHYTHM_SYSTEM_PROMPT,
  buildRhythmUserPrompt,
  TEXT_SYSTEM_PROMPT,
  buildTextUserPrompt,
} from './shopping-prompt.js';
import { callZai, extractJson, DEFAULT_MODEL } from '../ai/zai.js';

// shopping-suggester-port.js sözleşmesini uygular.
// Z.ai'nin OpenAI uyumlu /chat/completions ucu üzerinden alışveriş önerileri üretir.
const callAndParse = async ({ apiKey, model, fetchFn, onUsage, systemPrompt, userPrompt, timeoutMs, context }) => {
  const promptWithSchema = `${userPrompt}\n\nJSON şemasına uygun cevap ver: ${JSON.stringify(SHOPPING_RESPONSE_SCHEMA)}`;

  const body = await callZai({
    apiKey,
    model,
    feature: 'shopping',
    systemPrompt,
    userPrompt: promptWithSchema,
    temperature: 0.3,
    maxTokens: 2048,
    timeoutMs,
    fetchFn,
    onUsage,
    context,
  });

  const parsed = extractJson(body);
  return parsed.suggestions ?? [];
};

const makeZaiShoppingSuggester = ({ apiKey, model = DEFAULT_MODEL, fetchFn = fetch, onUsage }) => {
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

export { makeZaiShoppingSuggester };
