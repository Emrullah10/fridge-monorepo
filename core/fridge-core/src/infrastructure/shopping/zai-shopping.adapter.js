import {
  SHOPPING_RESPONSE_SCHEMA,
  RHYTHM_SYSTEM_PROMPT,
  buildRhythmUserPrompt,
  TEXT_SYSTEM_PROMPT,
  buildTextUserPrompt,
} from './shopping-prompt.js';
import { callZaiCached, extractJson, DEFAULT_MODEL } from '../ai/zai.js';

// shopping-suggester-port.js sözleşmesini uygular.
// Z.ai'nin OpenAI uyumlu /chat/completions ucu üzerinden alışveriş önerileri üretir.
//
// cacheable/cache/householdId/ttlSeconds SADECE fromText'ten geçiyor (bkz.
// makeZaiShoppingSuggester.fromText) — suggest (satın alma RİTMİ) her
// kullanıcıda kökten farklı bir profil taşıdığı için cache hit oranı ~0
// olurdu, cacheable:false ile callZaiCached aynen callZai gibi davranır
// (bkz. plan §Redis Faz 2).
const callAndParse = async ({
  apiKey, model, fetchFn, onUsage, systemPrompt, userPrompt, timeoutMs, context,
  cache, cacheable = false, householdId, ttlSeconds,
}) => {
  const promptWithSchema = `${userPrompt}\n\nJSON şemasına uygun cevap ver: ${JSON.stringify(SHOPPING_RESPONSE_SCHEMA)}`;

  const body = await callZaiCached({
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
    cache,
    cacheable,
    householdId,
    ttlSeconds,
  });

  const parsed = extractJson(body);
  return parsed.suggestions ?? [];
};

const makeZaiShoppingSuggester = ({ apiKey, model = DEFAULT_MODEL, fetchFn = fetch, onUsage, cache, cacheEnabled = false, cacheTtlSeconds }) => {
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
        // cacheable verilmedi -> false, callZai ile birebir aynı davranış.
      });
      return { suggestions };
    },

    // fromText: kullanıcının serbest metni + envanter özeti deterministik
    // olmayan (temperature 0.3) ama düşük — "2 kilo domates 1 ekmek" gibi
    // girdiler kullanıcılar arasında gerçekten tekrar eder (bkz. plan).
    // householdId ile izole ediliyor.
    fromText: async ({ text, inventorySummary, context, householdId = null }) => {
      const suggestions = await callAndParse({
        apiKey,
        model,
        fetchFn,
        onUsage,
        systemPrompt: TEXT_SYSTEM_PROMPT,
        userPrompt: buildTextUserPrompt({ text, inventorySummary }),
        timeoutMs: 20_000,
        context,
        cache,
        cacheable: cacheEnabled,
        householdId,
        ttlSeconds: cacheTtlSeconds,
      });
      return { suggestions };
    },
  };
};

export { makeZaiShoppingSuggester };
