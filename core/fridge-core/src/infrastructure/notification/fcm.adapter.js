import { getApps, getApp, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { log } from '@fridge/helper';

const FCM_BATCH_SIZE = 500; // sendEachForMulticast'in tek çağrıda kabul ettiği üst sınır.

const INVALID_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
]);

// FCM data payload'ı yalnızca string değer kabul eder; sayı/boolean/null
// gönderilirse SDK tüm batch'i reddeder.
const stringifyData = (data = {}) => {
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = String(value);
  }
  return result;
};

const makeFcmNotifier = ({ serviceAccount, projectId }) => {
  // node --watch her dosya değişikliğinde modülü yeniden yükler —
  // initializeApp'i tekrar çağırmak app/duplicate-app fırlatır.
  const app = getApps().length ? getApp() : initializeApp({ credential: cert(serviceAccount), projectId });
  const messaging = getMessaging(app);

  const chunk = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  return {
    sendToTokens: async ({ tokens, title, body, data }) => {
      if (tokens.length === 0) {
        return { successCount: 0, invalidTokens: [] };
      }

      let successCount = 0;
      const invalidTokens = [];

      for (const batch of chunk(tokens, FCM_BATCH_SIZE)) {
        try {
          const response = await messaging.sendEachForMulticast({
            tokens: batch,
            notification: { title, body },
            data: stringifyData(data),
          });

          successCount += response.successCount;
          response.responses.forEach((result, index) => {
            if (!result.success && INVALID_TOKEN_ERROR_CODES.has(result.error?.code)) {
              invalidTokens.push(batch[index]);
            }
          });
        } catch (error) {
          log.error('fcm_send_failed', { message: error.message });
        }
      }

      return { successCount, invalidTokens };
    },
  };
};

export { makeFcmNotifier };
