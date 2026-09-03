import { AiQuotaError, AiBusyError, AiTimeoutError } from '@fridge/errors';

// Dört Gemini adaptörü (parser, recipe, chef, shopping) birebir aynı
// fetch + AbortController + hata sınıflandırma + token muhasebesi mantığını
// tekrarlıyordu — burada tek kaynaktan paylaşılıyor. Her adaptör kendi
// systemPrompt/contents/generationConfig/timeoutMs değerini geçirir, bu
// dosya sadece HTTP + hata + retry + kullanım ölçümünü yönetir.
//
// ÖLÇÜM: usageMetadata daha önce hiç okunmuyordu — hangi özelliğin kaç
// token harcadığına dair sıfır veri vardı. onUsage callback'i (varsa)
// başarılı VE başarısız her çağrıdan sonra çağrılır; ai-usage-log
// repository'sine yazmak için kullanılır (bkz. container.js).
//
// RETRY: Google 429 (RESOURCE_EXHAUSTED, kota bitti) retry edilmez —
// boşuna beklemek kullanıcıyı gereksiz oyalar, doğrudan AiQuotaError.
// 500/502/503 (geçici aşırı yüklenme) üstel backoff ile 2 kez denenir;
// Google gövdesinde retryDelay varsa ona uyulur. Timeout (AbortError) hiç
// retry edilmez — kullanıcı zaten timeoutMs kadar beklemiş.
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryDelayMs = (errorBody) => {
  const details = errorBody?.error?.details;
  if (!Array.isArray(details)) return null;
  const retryInfo = details.find((d) => d['@type']?.includes('RetryInfo'));
  const retryDelay = retryInfo?.retryDelay;
  if (typeof retryDelay !== 'string') return null;
  const seconds = Number(retryDelay.replace('s', ''));
  return Number.isFinite(seconds) ? seconds * 1000 : null;
};

const classifyHttpError = async (response) => {
  let errorBody = null;
  try {
    errorBody = await response.json();
  } catch {
    // Gövde JSON değilse yok say — statusText'e düşülür.
  }
  const googleStatus = errorBody?.error?.status;
  const message = errorBody?.error?.message || response.statusText;
  return { status: response.status, googleStatus, message, retryDelayMs: parseRetryDelayMs(errorBody) };
};

const callGemini = async ({
  apiKey,
  model,
  feature,
  systemPrompt,
  contents,
  generationConfig,
  timeoutMs,
  fetchFn = fetch,
  onUsage,
  // Kullanım kırılımı (kim ne kadar harcıyor) — use-case katmanından taşınır,
  // callGemini'nin kendisi bilmez. Önceden onUsage() bu alanları HİÇ
  // geçirmiyordu, ai_usage_log.user_id/household_id/is_guest her satırda
  // NULL/false kalıyordu (bkz. buglog). context opsiyonel — geçirilmezse
  // eski davranış (null alanlar) korunur, geriye dönük kırılma yok.
  context = {},
}) => {
  const startedAt = Date.now();
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
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
            contents,
            generationConfig,
          }),
        },
      );
    } catch (error) {
      clearTimeout(timeout);
      const isAbort = error?.name === 'AbortError';
      const latencyMs = Date.now() - startedAt;
      onUsage?.({ ...context, feature, model, ok: false, httpStatus: null, errorCode: isAbort ? 'AI_TIMEOUT' : 'NETWORK_ERROR', latencyMs, retryCount: attempt });
      if (isAbort) throw new AiTimeoutError();
      lastError = error;
      break;
    }
    clearTimeout(timeout);

    if (response.ok) {
      const body = await response.json();
      const usage = body.usageMetadata ?? {};
      const latencyMs = Date.now() - startedAt;
      onUsage?.({
        ...context,
        feature,
        model,
        ok: true,
        httpStatus: response.status,
        latencyMs,
        retryCount: attempt,
        promptTokens: usage.promptTokenCount ?? null,
        outputTokens: usage.candidatesTokenCount ?? null,
        thoughtTokens: usage.thoughtsTokenCount ?? null,
        totalTokens: usage.totalTokenCount ?? null,
      });
      return body;
    }

    const classified = await classifyHttpError(response);

    // 429: kota tükendi, retry'ın anlamı yok — hemen bildir.
    if (classified.status === 429) {
      const latencyMs = Date.now() - startedAt;
      onUsage?.({ ...context, feature, model, ok: false, httpStatus: 429, errorCode: 'AI_QUOTA_EXCEEDED', latencyMs, retryCount: attempt });
      throw new AiQuotaError();
    }

    // 500/502/503: geçici — son deneme değilse backoff'la tekrar dene.
    if ([500, 502, 503].includes(classified.status) && attempt < MAX_RETRIES) {
      const backoff = classified.retryDelayMs ?? BASE_BACKOFF_MS * 2 ** attempt;
      await sleep(backoff);
      lastError = classified;
      continue;
    }

    const latencyMs = Date.now() - startedAt;
    if ([500, 502, 503].includes(classified.status)) {
      onUsage?.({ ...context, feature, model, ok: false, httpStatus: classified.status, errorCode: 'AI_BUSY', latencyMs, retryCount: attempt });
      throw new AiBusyError();
    }

    // Beklenmeyen durum kodu (4xx dışındakiler, ör. 400 kötü istek) —
    // sınıflandırmaya çalışmadan olduğu gibi fırlat, üst katman 500'e düşürsün.
    onUsage?.({ ...context, feature, model, ok: false, httpStatus: classified.status, errorCode: 'GEMINI_ERROR', latencyMs, retryCount: attempt });
    throw new Error(`Gemini ${feature} request failed: ${classified.status} ${classified.message}`);
  }

  // Buraya sadece network hatası (fetch reject, abort değil) tüm denemeler
  // tükendiğinde düşer.
  throw lastError instanceof Error ? lastError : new Error(`Gemini ${feature} request failed`);
};

const extractJson = (body) => JSON.parse(body.candidates[0].content.parts[0].text);

export { callGemini, extractJson };
