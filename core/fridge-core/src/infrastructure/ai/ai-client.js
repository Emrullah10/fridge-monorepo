import { AiQuotaError, AiBusyError, AiTimeoutError } from '@fridge/errors';

// Z.ai'nin OpenAI-uyumlu chat/completions ucu için ortak istemci —
// gemini-client.js ile aynı sözleşme (onUsage, retry/backoff, hata
// sınıflandırması). Sağlayıcıya özgü sabitler (base URL, hata etiketi)
// bkz. ai/zai.js — bu dosya sağlayıcıdan bağımsız kalır ki ileride tekrar
// sağlayıcı değiştirmek gerekirse acı yalnızca zai.js'te yaşansın.
//
// ÖNEMLİ: Z.ai token limiti parametresi OpenAI'nin eski adı `max_tokens`'tır,
// yeni `max_completion_tokens` DEĞİL (docs.z.ai/api-reference/llm/chat-completion).
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const callAiModel = async ({
  baseUrl,
  providerLabel = 'ai',
  apiKey,
  model,
  feature,
  systemPrompt,
  userPrompt,
  messages,
  temperature = 0.1,
  maxTokens = 4096,
  thinking,
  timeoutMs,
  fetchFn = fetch,
  onUsage,
  context = {},
}) => {
  const startedAt = Date.now();

  const requestMessages = messages
    ? (systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages)
    : [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetchFn(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          ...(thinking ? { thinking } : {}),
          messages: requestMessages,
        }),
      });
    } catch (error) {
      clearTimeout(timeout);
      const isAbort = error?.name === 'AbortError';
      const latencyMs = Date.now() - startedAt;
      onUsage?.({ ...context, feature, model, ok: false, httpStatus: null, errorCode: isAbort ? 'AI_TIMEOUT' : 'NETWORK_ERROR', latencyMs, retryCount: attempt });
      if (isAbort) throw new AiTimeoutError();
      throw error;
    }
    clearTimeout(timeout);

    if (response.ok) {
      const body = await response.json();
      const usage = body.usage ?? {};
      const latencyMs = Date.now() - startedAt;
      onUsage?.({
        ...context,
        feature,
        model,
        ok: true,
        httpStatus: response.status,
        latencyMs,
        retryCount: attempt,
        promptTokens: usage.prompt_tokens ?? null,
        outputTokens: usage.completion_tokens ?? null,
        totalTokens: usage.total_tokens ?? null,
      });
      return body;
    }

    // 429: Groq'ta bu HER ZAMAN günlük/dakikalık kotaydı (pencere saatler
    // sürebileceği için retry edilmezdi). Z.ai'de 429 İKİ FARKLI ŞEYİ ifade
    // ediyor — gövdedeki error.code ayırt ediyor:
    //   - "1305" "temporarily overloaded": sunucu tarafı geçici yoğunluk,
    //     KOTA DEĞİL — kısa retry ile genelde geçiyor (canlı doğrulandı,
    //     bkz. docs/ZAI_MIGRATION_PLAN.md). Bunu kota sanıp key'i
    //     tükenmiş işaretlemek yaygın bir entegrasyon hatası.
    //   - diğer her şey: gerçek kota/limit, retry etmeden AiQuotaError.
    if (response.status === 429) {
      let errorBody = null;
      try {
        errorBody = await response.json();
      } catch {
        // gövde JSON değilse yok say
      }
      const isTransientOverload = errorBody?.error?.code === '1305';
      const latencyMs = Date.now() - startedAt;

      if (isTransientOverload && attempt < MAX_RETRIES) {
        onUsage?.({ ...context, feature, model, ok: false, httpStatus: 429, errorCode: 'AI_BUSY', latencyMs, retryCount: attempt });
        await sleep(BASE_BACKOFF_MS * 2 ** attempt);
        continue;
      }

      const errorCode = isTransientOverload ? 'AI_BUSY' : 'AI_QUOTA_EXCEEDED';
      onUsage?.({ ...context, feature, model, ok: false, httpStatus: 429, errorCode, latencyMs, retryCount: attempt });
      throw isTransientOverload ? new AiBusyError() : new AiQuotaError();
    }

    if ([500, 502, 503].includes(response.status) && attempt < MAX_RETRIES) {
      await sleep(BASE_BACKOFF_MS * 2 ** attempt);
      continue;
    }

    let errorBody = null;
    try {
      errorBody = await response.json();
    } catch {
      // gövde JSON değilse yok say
    }
    const latencyMs = Date.now() - startedAt;

    if ([500, 502, 503].includes(response.status)) {
      onUsage?.({ ...context, feature, model, ok: false, httpStatus: response.status, errorCode: 'AI_BUSY', latencyMs, retryCount: attempt });
      throw new AiBusyError();
    }

    const errorCode = `${providerLabel.toUpperCase()}_ERROR`;
    onUsage?.({ ...context, feature, model, ok: false, httpStatus: response.status, errorCode, latencyMs, retryCount: attempt });
    throw new Error(`${providerLabel} ${feature} request failed: ${response.status} ${errorBody?.error?.message ?? response.statusText}`);
  }
};

const extractJson = (body) => JSON.parse(body.choices[0].message.content);

export { callAiModel, extractJson };
