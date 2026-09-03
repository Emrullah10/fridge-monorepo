import { AiQuotaError, AiBusyError, AiTimeoutError } from '@fridge/errors';

// Groq'un OpenAI-uyumlu chat/completions ucu için ortak istemci —
// gemini-client.js ile aynı sözleşme (onUsage, retry/backoff, hata
// sınıflandırması) ama Groq'un kendi hata/rate-limit gövdesine göre.
// Groq'ta günlük istek kotası HTTP başlıklarında dönüyor
// (x-ratelimit-remaining-requests) — Gemini'nin aksine 429 gövdesinde
// retryDelay yok, bunun yerine x-ratelimit-reset-requests header'ı var.
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// "1m26.4s" / "577ms" gibi Groq'a özgü süre formatını ms'e çevirir.
const parseGroqDuration = (raw) => {
  if (!raw) return null;
  const match = /^(?:(\d+)m)?(\d+(?:\.\d+)?)s$|^(\d+)ms$/.exec(raw);
  if (!match) return null;
  if (match[3]) return Number(match[3]);
  const minutes = Number(match[1] ?? 0);
  const seconds = Number(match[2] ?? 0);
  return (minutes * 60 + seconds) * 1000;
};

const callGroq = async ({
  apiKey,
  model,
  feature,
  systemPrompt,
  userPrompt,
  temperature = 0.1,
  maxCompletionTokens = 4096,
  timeoutMs,
  fetchFn = fetch,
  onUsage,
}) => {
  const startedAt = Date.now();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetchFn('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature,
          max_completion_tokens: maxCompletionTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
    } catch (error) {
      clearTimeout(timeout);
      const isAbort = error?.name === 'AbortError';
      const latencyMs = Date.now() - startedAt;
      onUsage?.({ feature, model, ok: false, httpStatus: null, errorCode: isAbort ? 'AI_TIMEOUT' : 'NETWORK_ERROR', latencyMs, retryCount: attempt });
      if (isAbort) throw new AiTimeoutError();
      throw error;
    }
    clearTimeout(timeout);

    if (response.ok) {
      const body = await response.json();
      const usage = body.usage ?? {};
      const latencyMs = Date.now() - startedAt;
      onUsage?.({
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

    // 429: günlük/dakikalık kota — reset-requests header'ından ne kadar
    // beklenmesi gerektiğini oku, ama günlük pencere saatler sürebileceği
    // için retry etmiyoruz, doğrudan AiQuotaError.
    if (response.status === 429) {
      const latencyMs = Date.now() - startedAt;
      onUsage?.({ feature, model, ok: false, httpStatus: 429, errorCode: 'AI_QUOTA_EXCEEDED', latencyMs, retryCount: attempt });
      throw new AiQuotaError();
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
      onUsage?.({ feature, model, ok: false, httpStatus: response.status, errorCode: 'AI_BUSY', latencyMs, retryCount: attempt });
      throw new AiBusyError();
    }

    onUsage?.({ feature, model, ok: false, httpStatus: response.status, errorCode: 'GROQ_ERROR', latencyMs, retryCount: attempt });
    throw new Error(`Groq ${feature} request failed: ${response.status} ${errorBody?.error?.message ?? response.statusText}`);
  }
};

const extractJson = (body) => JSON.parse(body.choices[0].message.content);

export { callGroq, extractJson, parseGroqDuration };
