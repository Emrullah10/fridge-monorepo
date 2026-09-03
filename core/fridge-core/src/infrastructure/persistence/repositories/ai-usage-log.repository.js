import { log } from '@fridge/helper';

// gemini-client.js'in onUsage callback'inin yazdığı yer. Yazma fire-and-forget
// olmalı — bir log satırı düşmezse kullanıcının isteği ASLA patlamamalı (FCM
// no-op adaptörüyle aynı ilke, bkz. config/src/index.js yorumu). Bu yüzden
// record() kendi try/catch'ini yönetir ve hiçbir zaman reject etmez.
const makeAiUsageLogRepository = ({ rawQuery }) => {
  return {
    record: async ({
      feature,
      model,
      userId = null,
      householdId = null,
      isGuest = false,
      ok,
      httpStatus = null,
      errorCode = null,
      latencyMs = null,
      retryCount = 0,
      promptTokens = null,
      outputTokens = null,
      thoughtTokens = null,
      totalTokens = null,
    }) => {
      try {
        await rawQuery(
          `INSERT INTO ai_usage_log
             (feature, model, user_id, household_id, is_guest, ok, http_status,
              error_code, latency_ms, retry_count, prompt_tokens, output_tokens,
              thought_tokens, total_tokens)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            feature, model, userId, householdId, isGuest, ok, httpStatus,
            errorCode, latencyMs, retryCount, promptTokens, outputTokens,
            thoughtTokens, totalTokens,
          ],
        );
      } catch (error) {
        log.warn('ai_usage_log_write_failed', { message: error.message, feature });
      }
    },
  };
};

export { makeAiUsageLogRepository };
